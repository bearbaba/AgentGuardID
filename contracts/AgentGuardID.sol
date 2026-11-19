// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Non-transferable Agent ID registry interface on BNB Smart Chain.
interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title AgentGuard ID
/// @notice Agent-ID-gated approvals for calls to cooperating application contracts.
/// @dev Does NOT custody tokens, control external wallets, or authorize arbitrary transfers.
///      Target apps MUST call consumeAuthorization from their agent-authenticated action paths.
contract AgentGuardID {
    error ZeroAddress();
    error InvalidPolicy();
    error InvalidExpiry();
    error AgentIDRequired();
    error NotWorkspaceOwner();
    error NotWorkspaceAgent();
    error WorkspaceDisabled();
    error TargetNotAllowed();
    error InvalidAction();
    error InvalidState();
    error Expired();
    error DailyLimitReached();
    error PayloadMismatch();
    error UnauthorizedTarget();

    enum Status { NONE, REQUESTED, APPROVED, CONSUMED, CANCELLED }

    struct Workspace {
        address owner;
        address agent;
        uint32 dailyLimit;
        bool active;
    }

    struct Authorization {
        uint256 workspaceId;
        address target;
        address agent;
        bytes32 payloadHash;
        uint64 expiresAt;
        Status status;
    }

    IAgentID public immutable agentID;
    uint256 public workspaceCount;
    uint256 public authorizationCount;

    mapping(uint256 => Workspace) public workspaces;
    mapping(uint256 => Authorization) public authorizations;
    mapping(uint256 => mapping(address => bool)) public allowedTargets;
    mapping(uint256 => mapping(uint256 => uint256)) public dailyUsage; // workspaceId => UTC day => count
    // Workspace changes invalidate ALL unconsumed authorizations, even after a change is reverted.
    mapping(uint256 => uint256) public workspaceRevision;
    mapping(uint256 => uint256) public authorizationRevision;

    event WorkspaceCreated(uint256 indexed workspaceId, address indexed owner, address indexed agent, uint32 dailyLimit);
    event AgentChanged(uint256 indexed workspaceId, address indexed previousAgent, address indexed newAgent);
    event WorkspacePolicyUpdated(uint256 indexed workspaceId, uint32 dailyLimit, bool active);
    event TargetPermissionUpdated(uint256 indexed workspaceId, address indexed target, bool allowed);
    event AuthorizationRequested(uint256 indexed authorizationId, uint256 indexed workspaceId, address indexed agent, address target, bytes32 payloadHash, uint64 expiresAt);
    event AuthorizationApproved(uint256 indexed authorizationId, address indexed owner);
    event AuthorizationCancelled(uint256 indexed authorizationId, address indexed actor);
    event AuthorizationConsumed(uint256 indexed authorizationId, uint256 indexed workspaceId, address indexed agent, address target, bytes32 payloadHash);
    event WorkspaceRevisionAdvanced(uint256 indexed workspaceId, uint256 revision);

    function _advanceRevision(uint256 workspaceId) internal {
        uint256 revision = ++workspaceRevision[workspaceId];
        emit WorkspaceRevisionAdvanced(workspaceId, revision);
    }

    constructor(address agentIdRegistry) {
        if (agentIdRegistry == address(0)) revert ZeroAddress();
        agentID = IAgentID(agentIdRegistry);
    }

    modifier onlyOwner(uint256 workspaceId) {
        if (workspaces[workspaceId].owner != msg.sender || workspaceId == 0) revert NotWorkspaceOwner();
        _;
    }

    function hasAgentID(address account) public view returns (bool) {
        if (account == address(0)) return false;
        try agentID.balanceOf(account) returns (uint256 balance) {
            return balance > 0;
        } catch {
            return false;
        }
    }

    function createWorkspace(address agent, uint32 dailyLimit) external returns (uint256 id) {
        if (agent == address(0)) revert ZeroAddress();
        if (!hasAgentID(agent)) revert AgentIDRequired();
        if (dailyLimit == 0 || dailyLimit > 10000) revert InvalidPolicy();

        id = ++workspaceCount;
        workspaces[id] = Workspace({owner: msg.sender, agent: agent, dailyLimit: dailyLimit, active: true});
        emit WorkspaceCreated(id, msg.sender, agent, dailyLimit);
    }

    function setAgent(uint256 workspaceId, address agent) external onlyOwner(workspaceId) {
        if (agent == address(0)) revert ZeroAddress();
        if (!hasAgentID(agent)) revert AgentIDRequired();
        address previous = workspaces[workspaceId].agent;
        if (previous != agent) {
            workspaces[workspaceId].agent = agent;
            _advanceRevision(workspaceId);
        }
        emit AgentChanged(workspaceId, previous, agent);
        // Even rotating back does NOT resurrect an earlier approval.
    }

    function setPolicy(uint256 workspaceId, uint32 dailyLimit, bool active) external onlyOwner(workspaceId) {
        if (dailyLimit == 0 || dailyLimit > 10000) revert InvalidPolicy();
        Workspace storage w = workspaces[workspaceId];
        if (w.dailyLimit != dailyLimit || w.active != active) _advanceRevision(workspaceId);
        w.dailyLimit = dailyLimit;
        w.active = active;
        emit WorkspacePolicyUpdated(workspaceId, dailyLimit, active);
    }

    function setTarget(uint256 workspaceId, address target, bool allowed) external onlyOwner(workspaceId) {
        if (target == address(0)) revert ZeroAddress();
        if (allowedTargets[workspaceId][target] != allowed) _advanceRevision(workspaceId);
        allowedTargets[workspaceId][target] = allowed;
        emit TargetPermissionUpdated(workspaceId, target, allowed);
    }

    function requestAuthorization(uint256 workspaceId, address target, bytes32 payloadHash, uint64 expiresAt)
        external returns (uint256 id)
    {
        Workspace memory w = workspaces[workspaceId];
        if (workspaceId == 0 || w.agent != msg.sender) revert NotWorkspaceAgent();
        if (!w.active) revert WorkspaceDisabled();
        if (!hasAgentID(msg.sender)) revert AgentIDRequired();
        if (target == address(0) || !allowedTargets[workspaceId][target]) revert TargetNotAllowed();
        if (payloadHash == bytes32(0)) revert PayloadMismatch();
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + 7 days) revert InvalidExpiry();

        id = ++authorizationCount;
        authorizations[id] = Authorization({
            workspaceId: workspaceId,
            target: target,
            agent: msg.sender,
            payloadHash: payloadHash,
            expiresAt: expiresAt,
            status: Status.REQUESTED
        });
        authorizationRevision[id] = workspaceRevision[workspaceId];
        emit AuthorizationRequested(id, workspaceId, msg.sender, target, payloadHash, expiresAt);
    }

    function approveAuthorization(uint256 authorizationId) external {
        Authorization storage a = authorizations[authorizationId];
        if (a.workspaceId == 0) revert InvalidAction();
        Workspace memory w = workspaces[a.workspaceId];
        if (w.owner != msg.sender) revert NotWorkspaceOwner();
        if (a.status != Status.REQUESTED) revert InvalidState();
        if (a.agent != w.agent) revert NotWorkspaceAgent();
        if (block.timestamp > a.expiresAt) revert Expired();
        if (!w.active) revert WorkspaceDisabled();
        if (!allowedTargets[a.workspaceId][a.target]) revert TargetNotAllowed();
        if (!hasAgentID(w.agent)) revert AgentIDRequired();
        if (authorizationRevision[authorizationId] != workspaceRevision[a.workspaceId]) revert InvalidState();
        a.status = Status.APPROVED;
        emit AuthorizationApproved(authorizationId, msg.sender);
    }

    function cancelAuthorization(uint256 authorizationId) external {
        Authorization storage a = authorizations[authorizationId];
        if (a.workspaceId == 0) revert InvalidAction();
        Workspace memory w = workspaces[a.workspaceId];
        if (msg.sender != w.owner && msg.sender != w.agent) revert InvalidState();
        if (a.status != Status.REQUESTED && a.status != Status.APPROVED) revert InvalidState();
        a.status = Status.CANCELLED;
        emit AuthorizationCancelled(authorizationId, msg.sender);
    }

    /// @notice Called BY an allowlisted app contract during an action initiated by its authenticated agent.
    /// @dev The app MUST independently ensure the `agent` argument is its actual caller.
    function consumeAuthorization(uint256 authorizationId, address agent, bytes32 payloadHash) external {
        Authorization storage a = authorizations[authorizationId];
        if (a.workspaceId == 0) revert InvalidAction();
        Workspace memory w = workspaces[a.workspaceId];
        if (a.status != Status.APPROVED) revert InvalidState();
        if (block.timestamp > a.expiresAt) revert Expired();
        if (!w.active) revert WorkspaceDisabled();
        if (agent != w.agent || agent != a.agent || !hasAgentID(agent)) revert AgentIDRequired();
        if (msg.sender != a.target) revert UnauthorizedTarget();
        if (!allowedTargets[a.workspaceId][msg.sender]) revert TargetNotAllowed();
        if (a.payloadHash != payloadHash) revert PayloadMismatch();
        if (authorizationRevision[authorizationId] != workspaceRevision[a.workspaceId]) revert InvalidState();

        uint256 day = block.timestamp / 1 days;
        if (dailyUsage[a.workspaceId][day] >= w.dailyLimit) revert DailyLimitReached();

        // Update state before returning control to the caller to prevent reuse/reentrancy.
        a.status = Status.CONSUMED;
        dailyUsage[a.workspaceId][day] += 1;
        emit AuthorizationConsumed(authorizationId, a.workspaceId, agent, msg.sender, payloadHash);
    }

    function getTodayUsage(uint256 workspaceId) external view returns (uint256 used, uint256 limit) {
        return (dailyUsage[workspaceId][block.timestamp / 1 days], workspaces[workspaceId].dailyLimit);
    }
}

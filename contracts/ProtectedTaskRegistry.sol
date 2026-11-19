// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentGuardID {
    function consumeAuthorization(uint256 authorizationId, address agent, bytes32 payloadHash) external;
}

/// @notice Example third-party app enforcing AgentGuard approvals.
/// @dev No funds are transferred; this demo proves target-side authorization enforcement.
contract ProtectedTaskRegistry {
    IAgentGuardID public immutable guard;

    // The result hash is an agent-submitted commitment, NOT independent verification of truth.
    struct Task { address agent; bytes32 contentHash; bytes32 resultHash; uint64 timestamp; uint256 authorizationId; }
    Task[] public tasks;

    event TaskRecorded(uint256 indexed taskId, address indexed agent, uint256 indexed authorizationId, bytes32 contentHash, bytes32 resultHash);

    constructor(address guardAddress) {
        require(guardAddress != address(0), "zero guard");
        guard = IAgentGuardID(guardAddress);
    }

    function recordTask(uint256 authorizationId, bytes32 contentHash, bytes32 resultHash)
        external returns (uint256 taskId)
    {
        require(contentHash != bytes32(0), "empty intent hash");
        require(resultHash != bytes32(0), "empty result hash");
        // msg.sender is the actual initiator. The guard validates the authorized Agent ID and intent.
        guard.consumeAuthorization(authorizationId, msg.sender, contentHash);
        taskId = tasks.length;
        tasks.push(Task({
            agent: msg.sender,
            contentHash: contentHash,
            resultHash: resultHash,
            timestamp: uint64(block.timestamp),
            authorizationId: authorizationId
        }));
        emit TaskRecorded(taskId, msg.sender, authorizationId, contentHash, resultHash);
    }

    function taskCount() external view returns (uint256) { return tasks.length; }
}

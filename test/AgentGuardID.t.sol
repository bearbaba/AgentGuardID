// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/AgentGuardID.sol";
import "../contracts/MockAgentID.sol";
import "../contracts/ProtectedTaskRegistry.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes calldata) external;
    function expectRevert(bytes4) external;
}

/// @notice Foundry tests: forge test -vv (no forge-std dependency required).
contract AgentGuardIDTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant HUMAN = address(0xA11CE);
    address internal constant AGENT = address(0xB0B);
    address internal constant STRANGER = address(0xDEAD);
    bytes32 internal constant HASH = keccak256("Summarize daily on-chain risk reports");

    MockAgentID internal ids;
    AgentGuardID internal guard;
    ProtectedTaskRegistry internal app;

    function setUp() public {
        ids = new MockAgentID();
        ids.mintForTest(AGENT);
        guard = new AgentGuardID(address(ids));
        app = new ProtectedTaskRegistry(address(guard));
        vm.prank(HUMAN);
        guard.createWorkspace(AGENT, 2);
        vm.prank(HUMAN);
        guard.setTarget(1, address(app), true);
    }

    function _request() internal returns (uint256 id) {
        vm.prank(AGENT);
        id = guard.requestAuthorization(1, address(app), HASH, uint64(block.timestamp + 1 days));
    }

    function _approve(uint256 id) internal {
        vm.prank(HUMAN);
        guard.approveAuthorization(id);
    }

    function testApprovedActionExecutesOnce() public {
        uint256 id = _request();
        _approve(id);
        vm.prank(AGENT);
        uint256 taskId = app.recordTask(id, HASH);
        require(taskId == 0, "first task should be zero");
        require(app.taskCount() == 1, "task not recorded");
        (uint256 used, uint256 limit) = guard.getTodayUsage(1);
        require(used == 1 && limit == 2, "usage mismatch");
        vm.prank(AGENT);
        vm.expectRevert(AgentGuardID.InvalidState.selector);
        app.recordTask(id, HASH);
    }

    function testUnapprovedActionCannotExecute() public {
        uint256 id = _request();
        vm.prank(AGENT);
        vm.expectRevert(AgentGuardID.InvalidState.selector);
        app.recordTask(id, HASH);
    }

    function testAttackerCannotStealApproval() public {
        uint256 id = _request();
        _approve(id);
        vm.prank(STRANGER);
        vm.expectRevert(AgentGuardID.AgentIDRequired.selector);
        app.recordTask(id, HASH);
    }

    function testPayloadIsBound() public {
        uint256 id = _request();
        _approve(id);
        vm.prank(AGENT);
        vm.expectRevert(AgentGuardID.PayloadMismatch.selector);
        app.recordTask(id, keccak256("different"));
    }

    function testDailyCap() public {
        for (uint256 i = 0; i < 2; i++) {
            uint256 id = _request();
            _approve(id);
            vm.prank(AGENT);
            app.recordTask(id, HASH);
        }
        uint256 third = _request();
        _approve(third);
        vm.prank(AGENT);
        vm.expectRevert(AgentGuardID.DailyLimitReached.selector);
        app.recordTask(third, HASH);
    }

    function testExpiredApprovalFails() public {
        uint256 id = _request();
        _approve(id);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(AGENT);
        vm.expectRevert(AgentGuardID.Expired.selector);
        app.recordTask(id, HASH);
    }

    function testOnlyOwnerCanApprove() public {
        uint256 id = _request();
        vm.prank(AGENT);
        vm.expectRevert(AgentGuardID.NotWorkspaceOwner.selector);
        guard.approveAuthorization(id);
    }

    function testOnlyAgentIDHolderCanBeAgent() public {
        vm.prank(HUMAN);
        vm.expectRevert(AgentGuardID.AgentIDRequired.selector);
        guard.createWorkspace(STRANGER, 5);
    }

    function testRevokedTargetBlocksExecution() public {
        uint256 id = _request();
        _approve(id);
        vm.prank(HUMAN);
        guard.setTarget(1, address(app), false);
        vm.prank(AGENT);
        vm.expectRevert(AgentGuardID.TargetNotAllowed.selector);
        app.recordTask(id, HASH);
    }

    function testRotationBackDoesNotResurrectApprovedAction() public {
        uint256 id = _request();
        _approve(id);
        ids.mintForTest(STRANGER);
        vm.prank(HUMAN);
        guard.setAgent(1, STRANGER);
        vm.prank(HUMAN);
        guard.setAgent(1, AGENT);
        vm.prank(AGENT);
        vm.expectRevert(AgentGuardID.InvalidState.selector);
        app.recordTask(id, HASH);
        require(guard.workspaceRevision(1) == 3, "expected target setup + two rotations");
    }

    function testRevokingThenReallowingDoesNotResurrectApproval() public {
        uint256 id = _request();
        _approve(id);
        vm.prank(HUMAN);
        guard.setTarget(1, address(app), false);
        vm.prank(HUMAN);
        guard.setTarget(1, address(app), true);
        vm.prank(AGENT);
        vm.expectRevert(AgentGuardID.InvalidState.selector);
        app.recordTask(id, HASH);
    }

    function testPauseAndResumeRequireFreshApproval() public {
        uint256 id = _request();
        _approve(id);
        vm.prank(HUMAN);
        guard.setPolicy(1, 2, false);
        vm.prank(HUMAN);
        guard.setPolicy(1, 2, true);
        vm.prank(AGENT);
        vm.expectRevert(AgentGuardID.InvalidState.selector);
        app.recordTask(id, HASH);
        uint256 freshId = _request();
        _approve(freshId);
        vm.prank(AGENT);
        app.recordTask(freshId, HASH);
        require(app.taskCount() == 1, "fresh policy action should work");
    }

    function testUnchangedPolicyKeepsApproval() public {
        uint256 id = _request();
        _approve(id);
        vm.prank(HUMAN);
        guard.setPolicy(1, 2, true);
        vm.prank(AGENT);
        app.recordTask(id, HASH);
        require(app.taskCount() == 1, "noop should not invalidate");
    }

    function testPolicyChangeInvalidatesPendingRequestBeforeApproval() public {
        uint256 id = _request();
        vm.prank(HUMAN);
        guard.setPolicy(1, 1, true);
        vm.prank(HUMAN);
        vm.expectRevert(AgentGuardID.InvalidState.selector);
        guard.approveAuthorization(id);
    }

    function testRotatedAgentCannotUseOldApproval() public {
        uint256 id = _request();
        _approve(id);
        ids.mintForTest(STRANGER);
        vm.prank(HUMAN);
        guard.setAgent(1, STRANGER);
        vm.prank(AGENT);
        vm.expectRevert(AgentGuardID.AgentIDRequired.selector);
        app.recordTask(id, HASH);
    }
}

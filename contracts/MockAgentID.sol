// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice LOCAL TEST ONLY. Never use as the Agent ID registry for contest mainnet deployment.
contract MockAgentID {
    mapping(address => uint256) public balanceOf;
    function mintForTest(address to) external { require(to != address(0)); balanceOf[to] = 1; }
}

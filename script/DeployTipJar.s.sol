// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { TipJar } from "../src/TipJar.sol";

interface Vm {
    function envOr(string calldata key, address defaultValue) external view returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployTipJar {
    address internal constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;

    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (TipJar tipJar) {
        address usdcAddress = vm.envOr("USDC_ADDRESS", ARC_TESTNET_USDC);

        vm.startBroadcast();
        tipJar = new TipJar(usdcAddress);
        vm.stopBroadcast();
    }
}

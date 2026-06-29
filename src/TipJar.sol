// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract TipJar {
    struct Tip {
        address sender;
        uint256 amount;
        string message;
        uint256 timestamp;
    }

    uint256 public constant MAX_MESSAGE_BYTES = 280;

    IERC20 public immutable usdc;
    address public immutable owner;

    Tip[] private tips;
    uint256 private totalTipped;

    error InvalidUSDC();
    error ZeroAmount();
    error MessageTooLong();
    error TransferFailed();
    error NotOwner();

    event Tipped(address indexed sender, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed owner, uint256 amount);

    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) {
            revert InvalidUSDC();
        }

        usdc = IERC20(usdcAddress);
        owner = msg.sender;
    }

    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (bytes(message).length > MAX_MESSAGE_BYTES) {
            revert MessageTooLong();
        }

        bool transferred = usdc.transferFrom(msg.sender, address(this), amount);
        if (!transferred) {
            revert TransferFailed();
        }

        totalTipped += amount;
        tips.push(
            Tip({
                sender: msg.sender, amount: amount, message: message, timestamp: block.timestamp
            })
        );

        emit Tipped(msg.sender, amount, message, block.timestamp);
    }

    function getTips() external view returns (Tip[] memory) {
        return tips;
    }

    function getTotalTipped() external view returns (uint256) {
        return totalTipped;
    }

    function withdraw() external {
        if (msg.sender != owner) {
            revert NotOwner();
        }

        uint256 balance = usdc.balanceOf(address(this));
        bool transferred = usdc.transfer(owner, balance);
        if (!transferred) {
            revert TransferFailed();
        }

        emit Withdrawn(owner, balance);
    }
}

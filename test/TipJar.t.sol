// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { TipJar } from "../src/TipJar.sol";

interface Vm {
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData)
        external;
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function warp(uint256 timestamp) external;
}

contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "ERC20: insufficient allowance");
        allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract TipJarTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event Tipped(address indexed sender, uint256 amount, string message, uint256 timestamp);

    MockUSDC private usdc;
    TipJar private tipJar;

    address private owner = address(0xA11CE);
    address private tipper = address(0xB0B);
    address private secondTipper = address(0xCAFE);

    uint256 private constant ONE_USDC = 1_000000;

    function setUp() public {
        usdc = new MockUSDC();
        vm.prank(owner);
        tipJar = new TipJar(address(usdc));
        usdc.mint(tipper, 25 * ONE_USDC);
        usdc.mint(secondTipper, 10 * ONE_USDC);
    }

    function testTipRevertsWithoutApproval() public {
        vm.prank(tipper);
        vm.expectRevert();
        tipJar.tip(ONE_USDC, "thanks");
    }

    function testTipRevertsForZeroAmount() public {
        vm.startPrank(tipper);
        usdc.approve(address(tipJar), ONE_USDC);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        tipJar.tip(0, "thanks");
        vm.stopPrank();
    }

    function testTipRevertsWhenMessageExceedsLimit() public {
        bytes memory longMessage = new bytes(281);
        for (uint256 i = 0; i < longMessage.length; i++) {
            longMessage[i] = "a";
        }

        vm.startPrank(tipper);
        usdc.approve(address(tipJar), ONE_USDC);
        vm.expectRevert(TipJar.MessageTooLong.selector);
        tipJar.tip(ONE_USDC, string(longMessage));
        vm.stopPrank();
    }

    function testTipStoresRecordAndUpdatesTotal() public {
        uint256 timestamp = 1_777_777_777;
        vm.warp(timestamp);

        vm.startPrank(tipper);
        usdc.approve(address(tipJar), 3 * ONE_USDC);
        vm.expectEmit(true, false, false, true);
        emit Tipped(tipper, 3 * ONE_USDC, "build on Arc", timestamp);
        tipJar.tip(3 * ONE_USDC, "build on Arc");
        vm.stopPrank();

        TipJar.Tip[] memory tips = tipJar.getTips();

        assertEq(usdc.balanceOf(tipper), 22 * ONE_USDC);
        assertEq(usdc.balanceOf(address(tipJar)), 3 * ONE_USDC);
        assertEq(tipJar.getTotalTipped(), 3 * ONE_USDC);
        assertEq(tips.length, 1);
        assertEq(tips[0].sender, tipper);
        assertEq(tips[0].amount, 3 * ONE_USDC);
        assertEq(tips[0].message, "build on Arc");
        assertEq(tips[0].timestamp, timestamp);
    }

    function testMultipleTipsReturnAllRecordsAndTotal() public {
        vm.startPrank(tipper);
        usdc.approve(address(tipJar), 2 * ONE_USDC);
        tipJar.tip(ONE_USDC, "first");
        tipJar.tip(ONE_USDC, "second");
        vm.stopPrank();

        vm.startPrank(secondTipper);
        usdc.approve(address(tipJar), 5 * ONE_USDC);
        tipJar.tip(5 * ONE_USDC, "third");
        vm.stopPrank();

        TipJar.Tip[] memory tips = tipJar.getTips();

        assertEq(tipJar.getTotalTipped(), 7 * ONE_USDC);
        assertEq(tips.length, 3);
        assertEq(tips[0].sender, tipper);
        assertEq(tips[1].sender, tipper);
        assertEq(tips[2].sender, secondTipper);
        assertEq(tips[2].amount, 5 * ONE_USDC);
        assertEq(tips[2].message, "third");
    }

    function testWithdrawRevertsForNonOwner() public {
        vm.startPrank(tipper);
        usdc.approve(address(tipJar), ONE_USDC);
        tipJar.tip(ONE_USDC, "owner only");
        vm.expectRevert(TipJar.NotOwner.selector);
        tipJar.withdraw();
        vm.stopPrank();
    }

    function testOwnerWithdrawTransfersEntireBalance() public {
        vm.startPrank(tipper);
        usdc.approve(address(tipJar), 4 * ONE_USDC);
        tipJar.tip(4 * ONE_USDC, "withdraw me");
        vm.stopPrank();

        vm.prank(owner);
        tipJar.withdraw();

        assertEq(usdc.balanceOf(address(tipJar)), 0);
        assertEq(usdc.balanceOf(owner), 4 * ONE_USDC);
        assertEq(tipJar.getTotalTipped(), 4 * ONE_USDC);
    }

    function assertEq(uint256 actual, uint256 expected) private pure {
        require(actual == expected, "uint256 mismatch");
    }

    function assertEq(address actual, address expected) private pure {
        require(actual == expected, "address mismatch");
    }

    function assertEq(string memory actual, string memory expected) private pure {
        require(keccak256(bytes(actual)) == keccak256(bytes(expected)), "string mismatch");
    }
}

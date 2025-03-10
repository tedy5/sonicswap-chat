// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWETH {
    function deposit() external payable;
    function depositFor(address account) external payable returns (bool);
    function withdraw(uint256) external;
    function withdrawTo(address account, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

contract AITradingAssistant is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable WETH;
    address public orderExecutor;

    constructor(
        address initialOwner,
        address _weth,
        address initialExecutor
    ) Ownable(initialOwner) {
        WETH = _weth;
        orderExecutor = initialExecutor;
    }

    modifier onlyExecutorOrOwner() {
        require(msg.sender == owner() || msg.sender == orderExecutor, "Not authorized");
        _;
    }

    struct OrderDetails {
        bytes32 orderId;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
    }

    struct LimitOrder {
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
    }

    // State variables
    mapping(address => mapping(address => uint256)) public userBalances; // user => token => amount
    mapping(bytes32 => LimitOrder) public limitOrders;
    bytes32[] public activeOrderIds;

    // Events
    event Received(address user, uint256 amount);
    event TokenReceived(address user, address token, uint256 amount);
    event Deposited(address user, address token, uint256 amount);
    event Withdrawn(address user, address token, uint256 amount);

    event LimitOrderCreated(
        bytes32 indexed orderId,
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    );
    event LimitOrderCancelled(bytes32 indexed orderId);
    event LimitOrderExecuted(
        bytes32 indexed orderId,
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    event SwapExecuted(
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event WalletSwapExecuted(
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    receive() external payable {
        IWETH(WETH).deposit{value: msg.value}();
        userBalances[msg.sender][WETH] += msg.value;
        emit Received(msg.sender, msg.value);
    }

    function setOrderExecutor(address newExecutor) external onlyOwner {
        require(newExecutor != address(0), "Invalid executor address");
        orderExecutor = newExecutor;
    }

    function depositToken(
        address token,
        uint256 amount,
        address user
    ) external nonReentrant {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        userBalances[user][token] += amount;
        emit TokenReceived(user, token, amount);
    }

    function depositFor(
        address user,
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(token != address(0), "Invalid token address");
        userBalances[user][token] += amount;
        emit Deposited(user, token, amount);
    }

    function createLimitOrder(
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external onlyOwner returns (bytes32) {
        require(userBalances[user][tokenIn] >= amountIn, "Insufficient balance");

        bytes32 orderId = keccak256(
            abi.encodePacked(
                user,
                tokenIn,
                tokenOut,
                amountIn,
                amountOutMin,
                block.timestamp
            )
        );

        require(limitOrders[orderId].amountIn == 0, "Order ID collision");

        limitOrders[orderId] = LimitOrder({
            user: user,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            amountOutMin: amountOutMin
        });

        activeOrderIds.push(orderId);
        userBalances[user][tokenIn] -= amountIn;

        emit LimitOrderCreated(
            orderId,
            user,
            tokenIn,
            tokenOut,
            amountIn,
            amountOutMin
        );

        return orderId;
    }

    function cancelLimitOrder(bytes32 orderId) public {
        LimitOrder memory order = limitOrders[orderId];
        require(order.user != address(0), "Order does not exist");
        require(
            msg.sender == owner() || msg.sender == order.user,
            "Unauthorized"
        );

        userBalances[order.user][order.tokenIn] += order.amountIn;

        for (uint i = 0; i < activeOrderIds.length; i++) {
            if (activeOrderIds[i] == orderId) {
                activeOrderIds[i] = activeOrderIds[activeOrderIds.length - 1];
                activeOrderIds.pop();
                break;
            }
        }

        delete limitOrders[orderId];
        emit LimitOrderCancelled(orderId);
    }

    function executeLimitOrder(
        bytes32 orderId,
        address router,
        bytes calldata swapData
    ) external onlyExecutorOrOwner nonReentrant {
        LimitOrder memory order = limitOrders[orderId];
        require(order.user != address(0), "Order does not exist");

        uint256 balanceBefore = IERC20(order.tokenOut).balanceOf(address(this));
        IERC20(order.tokenIn).approve(router, order.amountIn);

        (bool success, ) = router.call(swapData);
        require(success, "Swap failed");

        uint256 balanceAfter = IERC20(order.tokenOut).balanceOf(address(this));
        uint256 amountOut = balanceAfter - balanceBefore;
        require(amountOut >= order.amountOutMin, "Insufficient output amount");

        userBalances[order.user][order.tokenOut] += amountOut;

        for (uint i = 0; i < activeOrderIds.length; i++) {
            if (activeOrderIds[i] == orderId) {
                activeOrderIds[i] = activeOrderIds[activeOrderIds.length - 1];
                activeOrderIds.pop();
                break;
            }
        }
        delete limitOrders[orderId];

        emit LimitOrderExecuted(
            orderId,
            order.user,
            order.tokenIn,
            order.tokenOut,
            order.amountIn,
            amountOut
        );
    }

    function executeSwap(
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address router,
        bytes calldata swapData
    ) external onlyOwner nonReentrant {
        require(userBalances[user][tokenIn] >= amountIn, "Insufficient balance");

        userBalances[user][tokenIn] -= amountIn;
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));

        IERC20(tokenIn).approve(router, amountIn);
        (bool success, ) = router.call(swapData);
        require(success, "Swap failed");

        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        uint256 amountOut = balanceAfter - balanceBefore;

        userBalances[user][tokenOut] += amountOut;

        emit SwapExecuted(
            user,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut
        );
    }

    function executeWalletSwap(
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address router,
        bytes calldata swapData
    ) external onlyOwner nonReentrant {
        IERC20(tokenIn).safeTransferFrom(user, address(this), amountIn);

        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        IERC20(tokenIn).approve(router, amountIn);

        (bool success, ) = router.call(swapData);
        require(success, "Swap failed");

        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        uint256 amountOut = balanceAfter - balanceBefore;
        require(amountOut >= amountOutMin, "Insufficient output amount");

        if (tokenOut == WETH) {
            bool unwrapSuccess = IWETH(WETH).withdrawTo(user, amountOut);
            require(unwrapSuccess, "wS unwrap failed");
        } else {
            IERC20(tokenOut).safeTransfer(user, amountOut);
        }

        emit WalletSwapExecuted(
            user,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut
        );
    }

    function withdraw(
        address user,
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(userBalances[user][token] >= amount, "Insufficient balance");

        userBalances[user][token] -= amount;

        for (uint i = 0; i < activeOrderIds.length; i++) {
            LimitOrder storage order = limitOrders[activeOrderIds[i]];
            if (order.user == user && order.tokenIn == token) {
                cancelLimitOrder(activeOrderIds[i]);
            }
        }

        if (token == WETH) {
            bool success = IWETH(WETH).withdrawTo(user, amount);
            require(success, "WETH withdrawal failed");
        } else {
            IERC20(token).safeTransfer(user, amount);
        }

        emit Withdrawn(user, token, amount);
    }

    function userEmergencyWithdraw(address token) external nonReentrant {
        uint256 balance = userBalances[msg.sender][token];
        require(balance > 0, "No balance to withdraw");

        userBalances[msg.sender][token] = 0;

        for (uint i = 0; i < activeOrderIds.length; i++) {
            LimitOrder storage order = limitOrders[activeOrderIds[i]];
            if (order.user == msg.sender && order.tokenIn == token) {
                cancelLimitOrder(activeOrderIds[i]);
            }
        }

        if (token == WETH) {
            IWETH(WETH).withdraw(balance);
            (bool success, ) = msg.sender.call{value: balance}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, balance);
        }

        emit Withdrawn(msg.sender, token, balance);
    }

    function emergencyWithdraw(address token) external onlyOwner {
        if (token == WETH) {
            uint256 balance = address(this).balance;
            IWETH(WETH).withdraw(balance);
            (bool success, ) = owner().call{value: balance}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(
                owner(),
                IERC20(token).balanceOf(address(this))
            );
        }
    }

    function getUserBalance(address user, address token) external view returns (uint256) {
        return userBalances[user][token];
    }

    function getTotalActiveOrders() external view returns (uint256) {
        return activeOrderIds.length;
    }

    function getActiveOrders(uint256 offset, uint256 limit)
        external
        view
        returns (OrderDetails[] memory orders, uint256 total)
    {
        uint256 totalCount = activeOrderIds.length;
        uint256 size = limit;
        if (offset + limit > totalCount) {
            size = totalCount > offset ? totalCount - offset : 0;
        }

        OrderDetails[] memory result = new OrderDetails[](size);
        for (uint256 i = 0; i < size; i++) {
            uint256 orderIndex = offset + i;
            bytes32 orderId = activeOrderIds[orderIndex];
            LimitOrder memory order = limitOrders[orderId];

            result[i] = OrderDetails({
                orderId: orderId,
                tokenIn: order.tokenIn,
                tokenOut: order.tokenOut,
                amountIn: order.amountIn,
                amountOutMin: order.amountOutMin
            });
        }

        return (result, totalCount);
    }
}
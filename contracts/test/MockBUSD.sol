// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

pragma solidity 0.8.7;

contract MockBUSD is ERC20 {
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _mint(msg.sender, 100000000000 ether);
    }

    // public mint function for testing purposes
    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }

    function faucet() public {
        _mint(msg.sender, 10000 ether);
    }
}

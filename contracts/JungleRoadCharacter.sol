// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./lib/ERC1155Tradable.sol";

contract JungleRoadCharacter is ERC1155Tradable {
    constructor() ERC1155Tradable("Jungle Road Character", "JGRD-C", "") {}
}

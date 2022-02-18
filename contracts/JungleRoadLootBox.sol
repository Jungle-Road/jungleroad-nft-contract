// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./lib/ERC1155Tradable.sol";
import "./VRF.sol";

/**
 * @title JungleRoadLootBox
 * JungleRoadLootBox - a randomized and openable lootbox of JungleRoad
 * NFT.
 */
contract JungleRoadLootBox is ERC1155Tradable, ReentrancyGuard {
    using VRF for VRF.VRFState;

    VRF.VRFState state;

    constructor() ERC1155Tradable("Jungle Road Character Box", "JGRD-CB", "") {}

    function setState(
        address _factoryAddress,
        uint256 _numOptions,
        uint256 _numClasses,
        uint256 _seed
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        VRF.initState(state, _factoryAddress, _numOptions, _numClasses, _seed);
    }

    function setTokenIdsForClass(uint256 _classId, uint256[] memory _tokenIds) public onlyRole(DEFAULT_ADMIN_ROLE) {
        VRF.setTokenIdsForClass(state, _classId, _tokenIds);
    }

    function setOptionSettings(
        uint256 _option,
        uint256 _maxQuantityPerOpen,
        uint16[] memory _classProbabilities
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        VRF.setOptionSettings(state, _option, _maxQuantityPerOpen, _classProbabilities);
    }

    function setSeed(uint256 _seed) public onlyRole(DEFAULT_ADMIN_ROLE) {
        VRF.setSeed(state, _seed);
    }

    ///////
    // MAIN FUNCTIONS
    ///////
    function unbox(uint256 _optionId, address _toAddress) external {
        require(_msgSender() == tx.origin, "Only the EOA can unbox lootboxes");

        // This will underflow if _msgSender() does not own enough tokens.
        _burn(_msgSender(), _optionId, 1);
        // Mint nfts contained by LootBox
        VRF._mint(state, _optionId, _toAddress);
    }

    /**
     *  @dev Mint the token/option id.
     */
    function mint(
        address _to,
        uint256 _optionId,
        uint256 _amount,
        bytes memory _data
    ) public override nonReentrant onlyRole(FACTORY_ROLE) {
        require(_optionId < state.numOptions, "Lootbox: Invalid Option");

        // Option ID is used as a token ID here
        _mint(_to, _optionId, _amount, _data);
    }

    /**
     *  @dev track the number of tokens minted.
     */
    function _mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes memory _data
    ) internal override {
        tokenSupply[_id] = tokenSupply[_id] + _quantity;
        super._mint(_to, _id, _quantity, _data);
    }
}

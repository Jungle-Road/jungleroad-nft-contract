// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";

/*
  DESIGN NOTES:
  - We assume Class 0 is common!
  - Because this is a library we use a state struct rather than member
    variables. This struct is passes as the first argument to any functions that
    need it. This can make some function signatures look strange.
  - Because this is a library we cannot call owner(). We could include an owner
    field in the state struct, but this would add maintenance overhead for
    users of this library who have to make sure they change that field when
    changing the owner() of the contract that uses this library. We therefore
    append an _owner parameter to the argument list of functions that need to
    access owner(), which makes some function signatures (particularly _mint)
    look weird but is better than hiding a dependency on an easily broken
    state field.
  - We also cannot call onlyOwner or whenNotPaused. Users of this library should
    not expose any of the methods in this library, and should wrap any code that
    uses methods that set, reset, or open anything in onlyOwner().
    Code that calls _mint should also be wrapped in nonReentrant() and should
    ensure perform the equivalent checks to _canMint() in
    JungleRoadFactory.
 */

abstract contract Factory {
    function mintCharacter(uint256 _optionId, address _toAddress) external virtual;

    function balanceOf(address _owner, uint256 _optionId) public view virtual returns (uint256);
}

/**
 * @title VRF
 * VRF- support for a randomized and openable lootbox.
 */
library VRF {
    using SafeMath for uint256;

    // Event for logging lootbox opens
    event LootBoxOpened(uint256 indexed optionId, address indexed buyer, uint256 itemsMinted);
    event Warning(string message, address account);

    uint256 constant INVERSE_BASIS_POINT = 10000;

    // NOTE: Price of the lootbox is set via sell orders on Library
    struct OptionSettings {
        // Number of items to send per open.
        // Set to 0 to disable this Option.
        uint256 maxQuantityPerOpen;
        // Probability in basis points (out of 10,000) of receiving each class (descending)
        uint16[] classProbabilities;
    }

    struct VRFState {
        address factoryAddress;
        uint256 numOptions;
        uint256 numClasses;
        mapping(uint256 => OptionSettings) optionToSettings;
        mapping(uint256 => uint256[]) classToTokenIds;
        uint256 seed;
    }

    //////
    // INITIALIZATION FUNCTIONS FOR OWNER
    //////

    /**
     * @dev Set up the fields of the state that should have initial values.
     */
    function initState(
        VRFState storage _state,
        address _factoryAddress,
        uint256 _numOptions,
        uint256 _numClasses,
        uint256 _seed
    ) internal {
        _state.factoryAddress = _factoryAddress;
        _state.numOptions = _numOptions;
        _state.numClasses = _numClasses;
        _state.seed = _seed;
    }

    /**
     * @dev Alternate way to add token ids to a class
     * Note: resets the full list for the class instead of adding each token id
     */
    function setTokenIdsForClass(
        VRFState storage _state,
        uint256 _classId,
        uint256[] memory _tokenIds
    ) internal {
        require(_classId < _state.numClasses, "_class out of range");
        _state.classToTokenIds[_classId] = _tokenIds;
    }

    /**
     * @dev Set the settings for a particular lootbox option
     * @param _option The Option to set settings for
     * @param _maxQuantityPerOpen Maximum number of items to mint per open.
     *                            Set to 0 to disable this option.
     * @param _classProbabilities Array of probabilities (basis points, so integers out of 10,000)
     *                            of receiving each class (the index in the array).
     *                            Should add up to 10k and be descending in value.
     */
    function setOptionSettings(
        VRFState storage _state,
        uint256 _option,
        uint256 _maxQuantityPerOpen,
        uint16[] memory _classProbabilities
    ) internal {
        require(_option < _state.numOptions, "_option out of range");

        OptionSettings memory settings = OptionSettings({
            maxQuantityPerOpen: _maxQuantityPerOpen,
            classProbabilities: _classProbabilities
        });

        _state.optionToSettings[uint256(_option)] = settings;
    }

    /**
     * @dev Improve pseudorandom number generator by letting the owner set the seed manually,
     * making attacks more difficult
     * @param _newSeed The new seed to use for the next transaction
     */
    function setSeed(VRFState storage _state, uint256 _newSeed) internal {
        _state.seed = _newSeed;
    }

    ///////
    // MAIN FUNCTIONS
    //////

    /**
     * @dev Main minting logic for lootboxes
     * This is called via safeTransferFrom when JungleRoadLootBox extends
     * JungleRoadFactory.
     * NOTE: prices and fees are determined by the sell order on Library.
     * WARNING: Make sure msg.sender can mint!
     */
    function _mint(
        VRFState storage _state,
        uint256 _optionId,
        address _toAddress
    ) internal {
        require(_optionId < _state.numOptions, "_option out of range");
        // Load settings for this box option
        OptionSettings memory settings = _state.optionToSettings[_optionId];

        require(settings.maxQuantityPerOpen > 0, "VRF#_mint: OPTION_NOT_ALLOWED");

        uint256 totalMinted = 0;
        uint256 quantitySent = 0;

        while (quantitySent < settings.maxQuantityPerOpen) {
            uint256 class = _pickRandomClass(_state, settings.classProbabilities);
            _sendTokenWithClass(_state, class, _toAddress);
            quantitySent++;
        }

        totalMinted += quantitySent;

        // Event emissions
        emit LootBoxOpened(_optionId, _toAddress, totalMinted);
    }

    /////
    // HELPER FUNCTIONS
    /////

    // Returns the tokenId sent to _toAddress
    function _sendTokenWithClass(
        VRFState storage _state,
        uint256 _classId,
        address _toAddress
    ) internal returns (uint256) {
        require(_classId < _state.numClasses, "_class out of range");
        Factory factory = Factory(_state.factoryAddress);
        uint256 tokenId = _pickRandomAvailableTokenIdForClass(_state, _classId);
        // This may mint, create or transfer. We don't handle that here.
        // We use tokenId as an option ID here.
        factory.mintCharacter(tokenId, _toAddress);
        return tokenId;
    }

    // randomRare
    function _pickRandomClass(VRFState storage _state, uint16[] memory _classProbabilities) internal returns (uint256) {
        uint16 value = uint16(_random(_state).mod(INVERSE_BASIS_POINT));
        // Start at top class (length - 1)
        // skip common (0), we default to it
        for (uint256 i = _classProbabilities.length - 1; i > 0; i--) {
            uint16 probability = _classProbabilities[i];
            if (value < probability) {
                return i;
            } else {
                value = value - probability;
            }
        }
        return 0;
    }

    function _pickRandomAvailableTokenIdForClass(VRFState storage _state, uint256 _classId) internal returns (uint256) {
        require(_classId < _state.numClasses, "_class out of range");
        uint256[] memory tokenIds = _state.classToTokenIds[_classId];
        require(tokenIds.length > 0, "No token ids for _classId");
        uint256 randIndex = _random(_state).mod(tokenIds.length);
        uint256 tokenId = tokenIds[randIndex];
        return tokenId;
    }

    /**
     * @dev Pseudo-random number generator
     * NOTE: to improve randomness, generate it with an oracle
     */
    function _random(VRFState storage _state) internal returns (uint256) {
        uint256 randomNumber = uint256(
            keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp, msg.sender, _state.seed))
        );

        _state.seed = randomNumber;

        return randomNumber;
    }

    function _addTokenIdToClass(
        VRFState storage _state,
        uint256 _classId,
        uint256 _tokenId
    ) internal {
        // This is called by code that has already checked this, sometimes in a
        // loop, so don't pay the gas cost of checking this here.
        require(_classId < _state.numClasses, "_class out of range");
        _state.classToTokenIds[_classId].push(_tokenId);
    }
}

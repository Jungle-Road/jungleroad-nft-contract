// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./lib/IERC1155Tradable.sol";
import "hardhat/console.sol";

/**
 * @title JungleRoadFactory
 * JungleRoad - a factory contract for Jungle Road semi-fungible
 * tokens.
 */
contract JungleRoadFactory is Ownable, ReentrancyGuard, Pausable {
    IERC1155Tradable public immutable jungleRoad;
    IERC1155Tradable public immutable lootBox;
    IERC20 public immutable busd;

    // The number of character (not rarity classes!)
    uint256 public constant NUM_ITEM_OPTIONS = 25; // ID 0-24
    uint256 public constant MAX_LOOTBOX_SUPPLY = 4400;
    uint256 public constant LOOTBOX_ID = 0;
    uint256 public constant BOX_PRICE = 99 ether;
    uint256 public constant MAX_PURCHASE_PER_TX = 10; // max number of purchase lootbox per transaction

    uint256 public minted = 0; // number of minted loot boxes
    uint256 public opened = 0; // number of minted jungle roads

    bool private purchasePaused = false;
    bool private unboxPaused = false;

    event Purchased(uint256 indexed index, address indexed account, uint256 amount);
    event Unboxed(uint256 indexed index, address indexed account, uint256 optionId);

    constructor(
        IERC1155Tradable _jungleRoad,
        IERC1155Tradable _lootBox,
        IERC20 _busd
    ) {
        jungleRoad = _jungleRoad;
        lootBox = _lootBox;
        busd = _busd;
        _pause();
    }

    /**
     * this function will be called from users
     */
    function purchase(address _toAddress, uint256 _amount) external nonReentrant whenNotPaused canPurchase(_amount) {
        require(_msgSender() == tx.origin, "Only EOA can purchase LootBox");
        require(busd.transferFrom(_msgSender(), address(this), BOX_PRICE * _amount), "Insufficient funds");
        _mintLootBox(_toAddress, _amount);

        emit Purchased(0, _msgSender(), _amount);
    }

    /**
     * this function will be called from the loot box contract
     * mint only 1 NFT per transaction
     */
    function mintCharacter(uint256 _optionId, address _toAddress)
        external
        nonReentrant
        whenNotPaused
        canUnbox(_optionId)
    {
        require(_msgSender() == address(lootBox), "Only LootBox can call");
        _mintCharacter(_optionId, _toAddress);

        emit Unboxed(0, _toAddress, _optionId);
    }

    function withdraw() external onlyOwner {
        uint256 amount = busd.balanceOf(address(this));
        require(busd.transfer(owner(), amount), "Failed to transfer tokens");
    }

    function pause() external onlyOwner {
        require(!paused(), "Already paused");
        _pause();
    }

    function unpause() external onlyOwner {
        require(paused(), "Already unpaused");
        _unpause();
    }

    function pausePurchase() external onlyOwner {
        require(!purchasePaused, "Already paused");
        purchasePaused = true;
    }

    function unpausePurchase() external onlyOwner {
        require(purchasePaused, "Already unpaused");
        purchasePaused = false;
    }

    function pauseUnbox() external onlyOwner {
        require(!unboxPaused, "Already paused");
        unboxPaused = true;
    }

    function unpauseUnbox() external onlyOwner {
        require(unboxPaused, "Already unpaused");
        unboxPaused = false;
    }

    /**
     * lootboxes are minted here
     */
    function _mintLootBox(address _toAddress, uint256 _amount) private {
        minted += _amount;
        lootBox.mint(_toAddress, LOOTBOX_ID, _amount, "");
    }

    /**
     * jungle roads are minted here
     */
    function _mintCharacter(uint256 _option, address _toAddress) private {
        opened += 1;
        jungleRoad.mint(_toAddress, _option, 1, "");
    }

    function quantityInfo()
        public
        view
        returns (
            uint256 _minted,
            uint256 _opened,
            uint256 _available,
            uint256 _unopened
        )
    {
        return (minted, opened, MAX_LOOTBOX_SUPPLY - minted, minted - opened);
    }

    modifier canPurchase(uint256 _amount) {
        require(!purchasePaused, "Purchase is paused");
        require(_amount > 0, "Amount must be greater than 0");
        require(minted + _amount <= MAX_LOOTBOX_SUPPLY, "Loot box supply is exceeded");
        require(_amount <= MAX_PURCHASE_PER_TX, "Can not mint more than the max purchase per transaction");
        _;
    }

    modifier canUnbox(uint256 _option) {
        require(!unboxPaused, "Unbox is paused");
        require(_option < NUM_ITEM_OPTIONS, "Invalid option");
        _;
    }
}

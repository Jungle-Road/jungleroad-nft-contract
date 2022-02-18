const vals = require('./valuesCommon.js');

// Configure the lootbox
const setupLootBox = async (lootBox, factory) => {
  console.log('Setup NFT LootBox');
  let tx;
  tx = await lootBox.setState(
    factory.address,
    vals.NUM_JUNGLE_ROADS_OPTIONS,
    vals.NUM_CLASSES,
    123456789
  );
  console.log('setState', tx.hash);
  await tx.wait();

  // We have one token id per rarity class.
  for (let i = 0; i < vals.NUM_CLASSES; i++) {
    const tokenIds = vals.TOKEN_IDS_FOR_CLASSES[i];
    tx = await lootBox.setTokenIdsForClass(i, tokenIds);
    console.log('setTokenIdsForClass', i, tokenIds, tx.hash);
    await tx.wait();
  }

  await lootBox.setOptionSettings(
    vals.LOOTBOX_OPTION_ID,
    vals.LOOTBOX_OPTION_AMOUNT_PER_BOX,
    vals.LOOTBOX_OPTION_PROPABILITIES
  );
  console.log('setOptionSettings LOOTBOX_OPTION_ID', tx.hash);
  await tx.wait();
};

module.exports = {
  setupLootBox,
};

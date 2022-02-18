function findRarity(tokenId) {
  if ([0, 5, 10, 15, 20].includes(tokenId)) {
    return 'common';
  } else if ([1, 6, 11, 16, 21].includes(tokenId)) {
    return 'uncommon';
  } else if ([2, 7, 12, 17, 22].includes(tokenId)) {
    return 'rare';
  } else if ([3, 8, 13, 18, 23].includes(tokenId)) {
    return 'legendary';
  } else if ([4, 9, 14, 19, 24].includes(tokenId)) {
    return 'immortal';
  } else {
    assert.fail('invalid id');
  }
}

function findAnimal(tokenId) {
  if (tokenId < 5) {
    return 'monkey';
  } else if (tokenId < 10) {
    return 'bear';
  } else if (tokenId < 15) {
    return 'fox';
  } else if (tokenId < 20) {
    return 'cat';
  } else if (tokenId < 25) {
    return 'bird';
  } else {
    assert.fail('invalid id');
  }
}

module.exports = {
  findRarity,
  findAnimal,
};

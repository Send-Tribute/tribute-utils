require('babel-polyfill');
const ethers = require('ethers');

const { bigNumberify, formatUnits } = ethers.utils;

class Tribute {
  constructor(DAIContract, rDAIContract, userAddress) {
    this.DAIContract = DAIContract;
    this.DAI_DECIMALS = null;
    this.rDAIContract = rDAIContract;
    this.rDAI_DECIMALS = null;
    this.SELF_HAT_ID = null;
    this.userAddress = userAddress.toLowerCase();
    this.PROPORTION_BASE = bigNumberify('0xFFFFFFFF');
  }

  async get_DAI_DECIMALS() {
    if (this.DAI_DECIMALS === null) {
      this.DAI_DECIMALS = await this.DAIContract.decimals();
    }
    return this.DAI_DECIMALS;
  }

  async get_rDAI_DECIMALS() {
    if (this.rDAI_DECIMALS === null) {
      this.rDAI_DECIMALS = await this.rDAIContract.decimals();
    }
    return this.rDAI_DECIMALS;
  }

  async get_SELF_HAT_ID() {
    if (this.SELF_HAT_ID === null) {
      this.SELF_HAT_ID = await this.rDAIContract.SELF_HAT_ID;
    }
    return this.SELF_HAT_ID;
  }

  _calculateProportionWholeNumbers(proportions, balance_BN) {
    const portionWholeNum = proportions.map(portion => {
      return bigNumberify(portion)
        .mul(balance_BN)
        .div(this.PROPORTION_BASE);
    });
    return portionWholeNum;
  }

  _removeAddressesWithZeroFlow(recipientMap) {
    for (const [address, portion_BN] of Object.entries(recipientMap)) {
      if (portion_BN.eq(ethers.constants.Zero)) {
        delete recipientMap[address];
      }
    }
    return recipientMap;
  }

  async get_rDAIBalance(address) {
    const rDAI_DECIMALS = await this.get_rDAI_DECIMALS();
    let balance_BN = await this.rDAIContract.balanceOf(address);
    balance_BN = balance_BN.div(bigNumberify(10).pow(rDAI_DECIMALS));
    return balance_BN;
  }

  async generate(amountToTransfer) {
    const DAI_DECIMALS = await this.get_DAI_DECIMALS();
    const rDAI_DECIMALS = await this.get_rDAI_DECIMALS();

    // approve DAI
    const amountToTransfer_BN = bigNumberify(amountToTransfer).mul(
      bigNumberify(10).pow(rDAI_DECIMALS)
    );
    await this.DAIContract.approve(
      this.rDAIContract.address,
      amountToTransfer_BN
    );

    const balance_BN = await this.get_rDAIBalance(this.userAddress);

    const currentHat = await this.rDAIContract.getHatByAddress(
      this.userAddress
    );

    const { recipients, proportions } = currentHat;

    const portionWholeNum = this._calculateProportionWholeNumbers(
      proportions,
      balance_BN
    );

    // convert to object mapping
    let recipientMap = {};
    recipients.forEach(
      (address, i) => (recipientMap[address.toLowerCase()] = portionWholeNum[i])
    );

    const userBal = recipientMap[this.userAddress]
      ? recipientMap[this.userAddress]
      : balance_BN;

    recipientMap[this.userAddress] = userBal.add(
      bigNumberify(amountToTransfer)
    );
    recipientMap = this._removeAddressesWithZeroFlow(recipientMap);

    await this.rDAIContract.mintWithNewHat(
      amountToTransfer_BN,
      Object.keys(recipientMap),
      Object.values(recipientMap)
    );
  }

  async disable() {
    await this.rDAIContract.redeemAll();
  }

  async getInfo(address) {
    const balance_BN = await this.rDAIContract.balanceOf(address);
    const unclaimedBalance_BN = await this.rDAIContract.interestPayableOf(
      address
    );

    // Check if the user has a hat
    const currentHat = await this.rDAIContract.getHatByAddress(address);

    let { recipients, proportions } = currentHat;
    let unallocatedBalance;
    let portionWholeNum;

    // check if hat is empty
    if (recipients.length === 0) {
      unallocatedBalance = balance_BN;
    } else {
      // set all recepients to lower case to allow searching
      recipients = currentHat.recipients.map(r => r.toLowerCase());

      portionWholeNum = this._calculateProportionWholeNumbers(
        proportions,
        balance_BN
      );

      const userIdx = recipients.indexOf(address.toLowerCase());

      // check if user exists
      if (userIdx < 0) {
        unallocatedBalance = ethers.constants.Zero;
      } else {
        unallocatedBalance = portionWholeNum[userIdx];

        // remove user from portionWholeNum
        recipients.splice(userIdx, 1); // remove user from recipients
        portionWholeNum.splice(userIdx, 1); // remove user from the proportions
      }
    }

    const rDAI_DECIMALS = await this.get_rDAI_DECIMALS();

    return {
      allocations: {
        recipients: recipients.map(recipient =>
          ethers.utils.getAddress(recipient)
        ),
        proportions: portionWholeNum.map(portion =>
          formatUnits(portion, rDAI_DECIMALS)
        )
      },
      balance: formatUnits(balance_BN, rDAI_DECIMALS),
      unallocated_balance: formatUnits(unallocatedBalance, rDAI_DECIMALS),
      unclaimed_balance: formatUnits(unclaimedBalance_BN, rDAI_DECIMALS)
    };
  }

  async startFlow(recipientAddress, amount) {
    const amount_BN = bigNumberify(amount);

    const rDAI_DECIMALS = await this.get_rDAI_DECIMALS();

    const balance_BN = await this.get_rDAIBalance(this.userAddress);

    const currentHat = await this.rDAIContract.getHatByAddress(
      this.userAddress
    );

    const { recipients, proportions } = currentHat;

    const portionWholeNum = this._calculateProportionWholeNumbers(
      proportions,
      balance_BN
    );

    // turn recipients and proportions into map
    // convert to object mapping
    let recipientMap = {};
    recipients.forEach(
      (address, i) => (recipientMap[address.toLowerCase()] = portionWholeNum[i])
    );

    // validate if hat !exist
    const SELF_HAT_ID = await this.get_SELF_HAT_ID();
    if (currentHat.hatID.eq(SELF_HAT_ID) || currentHat.hatID.isZero()) {
      // if balance < amount
      if (balance_BN.lt(amount_BN)) throw 'insuffient balance';
    }

    // validate if there are amounts left in user portion
    if (!(this.userAddress in recipientMap)) throw 'insufficient balance left';

    let userBal = recipientMap[this.userAddress]
      ? recipientMap[this.userAddress]
      : balance_BN;
    let recipientBal = recipientMap[recipientAddress.toLowerCase()]
      ? recipientMap[recipientAddress.toLowerCase()]
      : ethers.constants.Zero;
    const sum = userBal.add(recipientBal);

    if (sum.lt(amount_BN)) throw 'insufficent balance left';

    // We have enough to update, continue and update values

    // update values between user and recipient
    const amountNeeded = amount_BN.sub(recipientBal);
    userBal = userBal.sub(amountNeeded);
    recipientBal = recipientBal.add(amountNeeded);

    // set values
    recipientMap[this.userAddress] = userBal;
    recipientMap[recipientAddress.toLowerCase()] = recipientBal;
    recipientMap = this._removeAddressesWithZeroFlow(recipientMap);

    // update to new hat values
    await this.rDAIContract.createHat(
      Object.keys(recipientMap),
      Object.values(recipientMap),
      true
    );
  }

  async endFlow(addressToRemove) {
    const rDAI_DECIMALS = await this.get_rDAI_DECIMALS();

    const balance_BN = await this.get_rDAIBalance(this.userAddress);

    const currentHat = await this.rDAIContract.getHatByAddress(
      this.userAddress
    );

    const { recipients, proportions } = currentHat;

    const portionWholeNum = this._calculateProportionWholeNumbers(
      proportions,
      balance_BN
    );

    // turn recipients and proportions into map
    // convert to object mapping
    let recipientMap = {};
    recipients.forEach(
      (address, i) => (recipientMap[address.toLowerCase()] = portionWholeNum[i])
    );

    // validate if hat !exist
    const SELF_HAT_ID = await this.get_SELF_HAT_ID();
    if (currentHat.hatID.eq(SELF_HAT_ID) || currentHat.hatID.isZero())
      throw 'No flows to end';

    // validate if there are amounts left in user portion
    if (!(addressToRemove.toLowerCase() in recipientMap))
      throw `address: ${addressToRemove} does not exist`;

    const userBal = recipientMap[this.userAddress]
      ? recipientMap[this.userAddress]
      : balance_BN;
    const recipientBal = recipientMap[addressToRemove.toLowerCase()]
      ? recipientMap[addressToRemove.toLowerCase()]
      : ethers.constants.Zero;
    const sum = userBal.add(recipientBal);

    // update and set values between user and recipient
    recipientMap[this.userAddress] = userBal.add(recipientBal);
    recipientMap[addressToRemove.toLowerCase()] = ethers.constants.Zero;
    recipientMap = this._removeAddressesWithZeroFlow(recipientMap);

    // update to new hat values
    await this.rDAIContract.createHat(
      Object.keys(recipientMap),
      Object.values(recipientMap),
      true
    );
  }

  async claimAmount(address) {
    // this cashes out all rDAI in both interest
    // and principal and sends it back to the user
    // NOTE: this amount is not added to the receiving user's hat, it shows up in their rDAIBalance
    await this.rDAIContract.payInterest(address);
  }
}

module.exports = Tribute;

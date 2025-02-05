// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract MockToken is ERC20, AccessControl, Pausable {

    bytes32 private constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 private constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint public INTIIAL_SUPPLY = 1_000_000 * (10 ** 18);

    address public admin;
    address public minter;
    address public pauser;

    error InvalidZeroAddress();

    constructor(address _minter, address _pauser) ERC20("MockToken", "MTK") {
        if (_minter == address(0)) revert InvalidZeroAddress();
        if (_pauser == address(0)) revert InvalidZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, _minter);
        _grantRole(PAUSER_ROLE, _pauser);
        admin = msg.sender;
        minter = _minter;
        pauser = _pauser;
        _mint(msg.sender, INTIIAL_SUPPLY);
    } 

    function mint(address _account, uint _amount) external onlyRole(MINTER_ROLE) {
        _mint(_account, _amount);
    }

    function burn(address _account, uint _amount) external onlyRole(MINTER_ROLE) {
        _burn(_account, _amount);
    }

    function transfer(address _to, uint _amount) public override whenNotPaused returns (bool) {
        super.transfer(_to, _amount);
    }

    function transferFrom(address _from, address _to, uint _amount) public override whenNotPaused returns (bool) {
        super.transferFrom(_from, _to, _amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}   
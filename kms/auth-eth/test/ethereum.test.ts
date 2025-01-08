import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { EthereumBackend } from '../src/ethereum';
import { BootInfo } from '../src/types';
import { KmsAuth } from "../typechain-types/KmsAuth";
import { AppAuth } from "../typechain-types/AppAuth";

// Declare global test contracts
declare global {
  var testContracts: {
    kmsAuth: KmsAuth;
    appAuth: AppAuth;
    appId: string;
    owner: SignerWithAddress;
  };
}

describe('EthereumBackend', () => {
  let kmsAuth: KmsAuth;
  let owner: SignerWithAddress;
  let backend: EthereumBackend;
  let mockBootInfo: BootInfo;
  let appId: string;
  let appAuth: AppAuth;

  beforeEach(async () => {
    // Get test contracts from global setup
    ({ kmsAuth, owner, appAuth, appId } = global.testContracts);

    // Initialize backend with KmsAuth contract address
    backend = new EthereumBackend(
      owner.provider,
      await kmsAuth.getAddress()
    );

    // Create mock boot info with valid addresses
    mockBootInfo = {
      appId,
      composeHash: ethers.encodeBytes32String('0x1234567890abcdef'),
      instanceId: ethers.Wallet.createRandom().address,
      deviceId: ethers.encodeBytes32String('0x123'),
      mrEnclave: ethers.encodeBytes32String('0x1234'),
      mrImage: ethers.encodeBytes32String('0x5678')
    };

    // Set up KMS info
    await kmsAuth.setKmsInfo({
      k256Pubkey: ethers.encodeBytes32String("0x1234"),
      caPubkey: ethers.encodeBytes32String("test-root-ca"),
      quote: ethers.encodeBytes32String("test-ra-report")
    });

    // Register enclave and image
    await kmsAuth.registerEnclave(mockBootInfo.mrEnclave);
    await kmsAuth.registerImage(mockBootInfo.mrImage);
    await appAuth.addComposeHash(mockBootInfo.composeHash);
  });

  describe('checkBoot', () => {
    it('should return true when all checks pass', async () => {
      const result = await backend.checkBoot(mockBootInfo, false);
      expect(result.reason).toBe('');
      expect(result.isAllowed).toBe(true);
    });

    it('should return true when enclave is not allowed but image is allowed', async () => {
      const badBootInfo = {
        ...mockBootInfo,
        mrEnclave: ethers.encodeBytes32String('0x9999'),
      };
      const result = await backend.checkBoot(badBootInfo, false);
      expect(result.reason).toBe('');
      expect(result.isAllowed).toBe(true);
    });

    it('should return true when image is not allowed but enclave is allowed', async () => {
      const badBootInfo = {
        ...mockBootInfo,
        mrImage: ethers.encodeBytes32String('0x9999')
      };
      const result = await backend.checkBoot(badBootInfo, false);
      expect(result.reason).toBe('');
      expect(result.isAllowed).toBe(true);
    });

    it('should return false when enclave and image are not registered', async () => {
      const badMrEnclave = ethers.encodeBytes32String('9999');
      const badMrImage = ethers.encodeBytes32String('9999');
      const badBootInfo = {
        ...mockBootInfo,
        mrEnclave: badMrEnclave,
        mrImage: badMrImage
      };
      const result = await backend.checkBoot(badBootInfo, false);
      expect(result.reason).toBe('Neither enclave nor image is allowed');
      expect(result.isAllowed).toBe(false);
    });

    it('should return false when app is not registered', async () => {
      const badBootInfo = {
        ...mockBootInfo,
        appId: ethers.Wallet.createRandom().address
      };
      const result = await backend.checkBoot(badBootInfo, false);
      expect(result.reason).toBe('App not registered');
      expect(result.isAllowed).toBe(false);
    });
  });
});

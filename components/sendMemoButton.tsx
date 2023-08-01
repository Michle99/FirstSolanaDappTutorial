import React, {useState, useCallback} from 'react';
import {Alert, Button, Linking} from 'react-native';
import {fromUint8Array} from 'js-base64';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {Keypair, PublicKey, RpcResponseAndContext, SignatureResult, SystemProgram, Transaction, TransactionInstruction} from '@solana/web3.js';

import {useAuthorization} from './providers/AuthorizationProvider';
import {RPC_ENDPOINT, useConnection} from './providers/ConnectionProvider';
import {alertAndLog} from '../util/alertAndLog';
import {TextEncoder} from 'text-encoding';


export default function SignTransactionButton() {
  const {connection} = useConnection();
  const {authorizeSession} = useAuthorization();
  const [signingInProgress, setSigningInProgress] = useState(false);
  // Construct a message buffer from a string.
  const message = "Hello Solana!";
  const messageBuffer = new TextEncoder().encode(message) as Buffer

  const sendMemo = useCallback(
    async (
        messageBuffer: Buffer,
    ): Promise<[string, RpcResponseAndContext<SignatureResult>]> => {
        const latestBlockhash = await connection.getLatestBlockhash();
        const signature = await transact(async (wallet: Web3MobileWallet) => {
        const authorizationResult = await authorizeSession(wallet);

        const memoProgramTransaction = new Transaction({
            ...latestBlockhash,
            feePayer: authorizationResult.publicKey,
        }).add(
            new TransactionInstruction({
            data: messageBuffer,
            keys: [],
            programId: new PublicKey(
                'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', // Memo Program address
            ),
            }),
        );

        const transactionSignatures = await wallet.signAndSendTransactions({
            transactions: [memoProgramTransaction],
        });
            return transactionSignatures[0];
        });

        // Add this step to confirm that the transaction was proccessed by the network.
        const confirmationResponse = await connection.confirmTransaction({
            signature: signature,
            ...latestBlockhash,
        });

        return [signature, confirmationResponse];
    },
    [authorizeSession, connection],
  );

  // Show an alert with an explorer link when we have a confirmed memo transaction.
  function showExplorerAlert(memoTransactionSignature: string, cluster: string) {
    const explorerUrl =
      'https://explorer.solana.com/tx/' +
      memoTransactionSignature +
      '?cluster=' +
      cluster;
    Alert.alert(
      'Success!',
      'Your message was successfully recorded. View your message on Solana Explorer:',
      [
        {text: 'View', onPress: () => Linking.openURL(explorerUrl)},
        {text: 'Cancel', style: 'cancel'},
      ],
    );
  }

  return (
    <Button
        title="Send Memo!"
        disabled={signingInProgress}
        onPress={async () => {
            if (signingInProgress) {
                return;
            }
            setSigningInProgress(true);
            try {
                const [memoTransactionSignature, confirmationResponse] = await sendMemo(messageBuffer);
                const err = confirmationResponse.value.err;
                if (err) {
                console.log(
                    'Failed to record message:' +
                    (err instanceof Error ? err.message : err),
                );
                } else {
                    // APP_CLUSTER is either 'devnet', 'testnet', 'mainnet-beta'.
                    showExplorerAlert(memoTransactionSignature, RPC_ENDPOINT);
                }
            } finally {
                setSigningInProgress(false);
            }
        }}
    />
);
}

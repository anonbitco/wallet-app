import { generateRandomEncryptionKey, decrypt } from '../secure/encrypt.web';
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import { IQRCodeConn, FirebaseRef, FIREBASE_BUCKET, IStorage } from './types';
import { storage, database } from 'firebase';
import { storeEncrypted, readEncrypted, deleteFromStorage } from '../../core/secure/storage.web';
import { CONN_EXTENSION } from '../../core/constants/app';
import Bowser from 'bowser';
import { browser } from 'webextension-polyfill-ts';
import { buildState } from './conn-ext-build-state/conn-ext-build-state';
import { store } from '../../redux/config';
import { openLoadingModal, closeLoadingModal } from '../../redux/ui/loading-modal/actions';
import { NavigationService } from '../../navigation/navigation-service';
import { extensionReduxUpdateState } from '../../redux/app/actions';
import { IBlockchainTransaction } from '../blockchain/types';
import { buildTransactions } from './conn-ext-build-state/build-transactions';

export const ConnectExtensionWeb = (() => {
    const getRealtimeDBConnectionsRef = () => {
        const realtimeDB = database().ref(FirebaseRef.EXTENSION_SYNC);
        return realtimeDB.child(FirebaseRef.CONNECTIONS);
    };

    const getRealtimeDBRequestsRef = () => {
        const realtimeDB = database().ref(FirebaseRef.EXTENSION_SYNC);
        return realtimeDB.child(FirebaseRef.REQUESTS);
    };

    const storeConnection = async (conn: IQRCodeConn) => {
        try {
            // store session
            await storeEncrypted(JSON.stringify(conn), CONN_EXTENSION, CONN_EXTENSION);
        } catch {
            Promise.reject();
        }
    };

    const disconnect = async (): Promise<void> => {
        // delete store ?
        try {
            // delete the connection session
            await deleteFromStorage(CONN_EXTENSION);
        } catch {
            Promise.reject();
        }
    };

    const getConnection = async (): Promise<IQRCodeConn> => {
        try {
            const stored = await readEncrypted(CONN_EXTENSION, CONN_EXTENSION);
            if (stored) {
                return JSON.parse(stored);
            }

            return undefined;
        } catch (err) {
            Promise.reject(err);
        }
    };

    // TODO: maybe find a better way to check this
    // it would help if it's not a promise because Dashboard is loading
    const isConnected = async (): Promise<boolean> => {
        try {
            const conn = await getConnection();
            if (conn) {
                return true;
            } else {
                return false;
            }
        } catch {
            //
        }
    };

    const getPlatformOS = async (): Promise<string> => {
        const platformInfo = await browser.runtime.getPlatformInfo();
        let os: string;

        switch (platformInfo.os) {
            case 'mac':
                os = encodeURIComponent('Mac OS');
                break;
            case 'win':
                os = 'Windows';
                break;
            case 'linux':
                os = 'Linux';
                break;
            case 'android':
                os = 'Android';
                break;
            default:
                break;
        }

        return os;
    };

    const generateQRCodeUri = async (): Promise<{ uri: string; conn: IQRCodeConn }> => {
        const conn: IQRCodeConn = {
            connectionId: uuidv4(),
            encKey: generateRandomEncryptionKey().toString(CryptoJS.enc.Base64),
            os: await getPlatformOS(),
            platform: Bowser.getParser(window.navigator.userAgent).getBrowserName()
        };

        let uri = 'mooonletExtSync:' + conn.connectionId + '@firebase' + '/?encKey=' + conn.encKey;
        if (conn.os) {
            uri = uri + '&os=' + conn.os;
        }
        if (conn.platform) {
            uri = uri + '&browser=' + conn.platform;
        }

        return { uri, conn };
    };

    const downloadFileStorage = async (connectionId: string): Promise<string> => {
        try {
            // Download file from Firebase Storage - State
            const urlDowndload = await storage()
                .refFromURL(FIREBASE_BUCKET)
                .child(connectionId)
                .getDownloadURL();

            const http = await fetch(urlDowndload);
            return (await http.text()).toString();
        } catch {
            Promise.reject();
        }
    };

    /**
     * Build extension state
     */
    const storeState = async (decryptedState: IStorage) => {
        try {
            const extState = await buildState(decryptedState);
            store.dispatch(extensionReduxUpdateState(extState) as any);
            // extensionStateLoaded check if needed
        } catch {
            //
        }
    };

    const listenLastSync = async () => {
        try {
            const connection = await getConnection();

            const connectionsRef = getRealtimeDBConnectionsRef();

            if (connection && connection?.connectionId) {
                connectionsRef.child(connection.connectionId).on('value', async (snapshot: any) => {
                    const snap = snapshot.val();

                    if (snap?.lastSynced && snap?.authToken) {
                        try {
                            // Extension the state from Firebase Storage
                            const extState = await downloadFileStorage(connection.connectionId);

                            if (extState) {
                                const decryptedState = JSON.parse(
                                    decrypt(extState, connection.encKey).toString(CryptoJS.enc.Utf8)
                                );

                                // Save state
                                storeState(decryptedState);

                                // Build wallets transactions
                                buildTransactions(decryptedState.state.wallets);
                            }
                        } catch {
                            //
                        }
                    } else {
                        // Connection does not exist!
                    }
                });
            }
        } catch {
            //
        }
    };

    const listenLastSyncForConnect = (conn: IQRCodeConn) => {
        const connectionsRef = getRealtimeDBConnectionsRef();

        connectionsRef.child(conn.connectionId).on('value', async (snapshot: any) => {
            const snap = snapshot.val();

            if (snap?.lastSynced && snap?.authToken) {
                // show loading untill data is fetch and state is build
                store.dispatch(openLoadingModal());

                try {
                    // Extension the state from Firebase Storage
                    const extState = await downloadFileStorage(conn.connectionId);

                    if (extState) {
                        const decryptedState = JSON.parse(
                            decrypt(extState, conn.encKey).toString(CryptoJS.enc.Utf8)
                        );

                        // Save state
                        storeState(decryptedState);

                        // Store connection
                        await storeConnection(conn);

                        // remove listener for connectionId
                        connectionsRef.child(conn.connectionId).off('value');

                        // navigate to Dashboard
                        NavigationService.navigate('MainNavigation', {});

                        buildTransactions(decryptedState.state.wallets);
                    }

                    // close loading modal
                    store.dispatch(closeLoadingModal() as any);
                } catch (err) {
                    store.dispatch(closeLoadingModal() as any);
                    Promise.reject(err);
                }
            } else {
                // Connection does not exist! Waiting for connections...
            }
        });
    };

    const getRequestIdParams = async (requestId: string): Promise<any> => {
        //
    };

    const listenerReqResponse = async (
        requestId: string,
        callback: (res: { txHash: string; tx: IBlockchainTransaction }) => void
    ) => {
        try {
            const connection = await getConnection();

            const requestsRef = getRealtimeDBRequestsRef();
            requestsRef
                .child(requestId)
                .child('res')
                .on('value', async (snapshot: any) => {
                    if (snapshot.exists()) {
                        const snap = await snapshot.val();

                        const tx: IBlockchainTransaction = JSON.parse(
                            decrypt(snap.tx, connection.encKey).toString(CryptoJS.enc.Utf8)
                        );

                        callback({ txHash: snap.txHash, tx });
                    }
                });
        } catch {
            //
        }
    };

    return {
        storeConnection,
        disconnect,
        getConnection,
        isConnected,
        generateQRCodeUri,
        downloadFileStorage,
        listenLastSync,
        listenLastSyncForConnect,
        getRequestIdParams,
        listenerReqResponse
    };
})();
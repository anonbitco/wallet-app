import React from 'react';
import {
    View,
    Image,
    TouchableOpacity,
    SafeAreaView,
    SectionList,
    SectionListData,
    Alert
} from 'react-native';
import stylesProvider from './styles';
import { IReduxState } from '../../../../redux/state';
import { withTheme, IThemeProps } from '../../../../core/theme/with-theme';
import { Icon } from '../../../../components/icon';
import { connect } from 'react-redux';
import { smartConnect } from '../../../../core/utils/smart-connect';
import { Text } from '../../../../library';
import { IContactsState, IContactState } from '../../../../redux/contacts/state';
import { selectContacts } from '../../../../redux/contacts/selectors';
import { formatAddress } from '../../../../core/utils/format-address';
import { translate } from '../../../../core/i18n';
import { Blockchain } from '../../../../core/blockchain/types';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { deleteContact, updateContactName } from '../../../../redux/contacts/actions';

export interface IReduxProps {
    contacts: ReadonlyArray<SectionListData<IContactsState>>;
    deleteContact: typeof deleteContact;
    updateContactName: typeof updateContactName;
}

export interface IExternalProps {
    blockchain: Blockchain;
    onContactSelected: (contact: IContactState) => void;
}

export const mapStateToProps = (state: IReduxState, ownprops: IExternalProps) => {
    return {
        contacts: selectContacts(state, ownprops.blockchain)
    };
};

const mapDispatchToProps = {
    deleteContact,
    updateContactName
};

export class AddressBookComponent extends React.Component<
    IReduxProps & IExternalProps & IThemeProps<ReturnType<typeof stylesProvider>>
> {
    public contactsSwipeableRef: ReadonlyArray<string> = new Array();
    public currentlyOpenSwipeable: string = null;

    public onPressUpdate(contact: IContactState) {
        const title = translate('Send.alertEditTitle');
        const message = translate('Send.alertEditDescription');
        const buttons = [
            {
                text: translate('App.labels.cancel'),
                onPress: () => {
                    /* console.log('Cancel Pressed')*/
                },
                type: 'cancel'
            },
            {
                text: translate('App.labels.save'),
                onPress: (inputValue: string) => {
                    if (inputValue !== '') {
                        const data: IContactState = {
                            address: contact.address,
                            blockchain: contact.blockchain,
                            name: inputValue
                        };
                        this.props.updateContactName(data);
                    }
                },
                type: 'default'
            }
        ];
        const type = 'plain-text';

        Alert.prompt(title, message, buttons, type);
    }

    public closeCurrentOpenedSwipable() {
        this.contactsSwipeableRef[this.currentlyOpenSwipeable] &&
            this.contactsSwipeableRef[this.currentlyOpenSwipeable].close();
    }

    public renderLeftActions = (contact: IContactState) => {
        const styles = this.props.styles;
        return (
            <View style={styles.leftActionsContainer}>
                <TouchableOpacity
                    style={styles.action}
                    onPress={() => {
                        this.props.deleteContact(contact.blockchain, contact.address);
                        this.closeCurrentOpenedSwipable();
                    }}
                >
                    <Icon name="bin" size={32} style={styles.iconActionNegative} />
                    <Text style={styles.textActionNegative}>{translate('Send.deleteContact')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.action}
                    onPress={() => {
                        this.onPressUpdate(contact);
                        this.closeCurrentOpenedSwipable();
                    }}
                >
                    <Icon name="pencil" size={28} style={styles.iconActionPositive} />
                    <Text style={styles.textActionPositive}>
                        {translate('Send.editContactName')}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    public onSwipeableWillOpen(index: string) {
        if (
            index !== this.currentlyOpenSwipeable &&
            this.contactsSwipeableRef[this.currentlyOpenSwipeable]
        ) {
            this.closeCurrentOpenedSwipable();
        }

        this.currentlyOpenSwipeable = index;
    }

    public renderContact(contact: IContactState) {
        const styles = this.props.styles;
        const index = `${contact.blockchain}|${contact.address}`;

        return (
            <Swipeable
                key={index}
                ref={ref => (this.contactsSwipeableRef[index] = ref)}
                renderLeftActions={() => this.renderLeftActions(contact)}
                onSwipeableWillOpen={() => this.onSwipeableWillOpen(index)}
            >
                <TouchableOpacity
                    style={styles.rowContainer}
                    onPress={() => this.props.onContactSelected(contact)}
                >
                    <View>
                        <Text style={styles.name}>{contact.name}</Text>
                        <Text style={styles.address}>{formatAddress(contact.address)}</Text>
                    </View>
                    <Icon name="add-circle" size={24} style={styles.icon} />
                </TouchableOpacity>
                <View style={styles.divider} />
            </Swipeable>
        );
    }

    public render() {
        const styles = this.props.styles;
        const { contacts } = this.props;

        if (contacts && contacts.length === 0) {
            return (
                <View style={styles.emptyAddressContainer}>
                    <Image
                        style={styles.logoImage}
                        source={require('../../../../assets/images/png/moonlet_space_gray.png')}
                    />
                    <Text style={styles.emptyAddressText}>{translate('Send.emptyAddress')}</Text>
                    <Text style={styles.addAddressBookText}>
                        {translate('Send.addAddressBook')}
                    </Text>
                </View>
            );
        } else {
            return (
                <SafeAreaView style={styles.container}>
                    <SectionList
                        sections={contacts}
                        keyExtractor={item => `${item.blockchain}|${item.address}`}
                        renderItem={({ item }) => this.renderContact(item)}
                        renderSectionHeader={({ section: { title } }) => (
                            <Text style={styles.sectionTitle}>{title}</Text>
                        )}
                    />
                </SafeAreaView>
            );
        }
    }
}

export const AddressBook = smartConnect<IExternalProps>(AddressBookComponent, [
    connect(mapStateToProps, mapDispatchToProps),
    withTheme(stylesProvider)
]);
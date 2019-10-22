import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../components/icon';
import { COLORS } from '../styles/colors';

export const DummyScreen = () => (
    <View style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
        <Text style={{ textAlign: 'center' }}>some screen</Text>
    </View>
);

// TODO use theme for colors
export const menuIcon = (icon: string) => ({ focused }: any) => (
    <Icon name={icon} size={25} style={{ color: focused ? COLORS.AQUA : COLORS.LIGHT_GRAY }} />
);

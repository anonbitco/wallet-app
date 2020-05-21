import React from 'react';
import { View } from 'react-native';
import { withTheme, IThemeProps } from '../../core/theme/with-theme';
import stylesProvider from './styles';
import { smartConnect } from '../../core/utils/smart-connect';
import { IButtonCTA } from '../../core/blockchain/types/token';
import { Button } from '../../library';
import { BORDER_RADIUS } from '../../styles/dimensions';
import { NavigationService } from '../../navigation/navigation-service';
import { translate } from '../../core/i18n/translation/translate';

export interface IExternalProps {
    mainCta: IButtonCTA;
    otherCtas?: IButtonCTA[];
}

export const CtaGroupComponent = (
    props: IExternalProps & IThemeProps<ReturnType<typeof stylesProvider>>
) => {
    return (
        <View style={props.styles.container}>
            {props?.otherCtas && (
                <View style={props.styles.topContainer}>
                    {props.otherCtas.map((cta: IButtonCTA, index: number) => (
                        <Button
                            key={`cta-${index}`}
                            leftIcon={cta.iconName}
                            onPress={() =>
                                NavigationService.navigate(
                                    cta.navigateTo.screen,
                                    cta.navigateTo.params
                                )
                            }
                            bottomLabel={translate(cta.title)}
                            style={{ borderRadius: BORDER_RADIUS + BORDER_RADIUS / 2 }}
                        />
                    ))}
                </View>
            )}
            <Button
                primary
                leftIcon={props.mainCta.iconName}
                onPress={() =>
                    NavigationService.navigate(
                        props.mainCta.navigateTo.screen,
                        props.mainCta.navigateTo.params
                    )
                }
            >
                {translate(props.mainCta.title)}
            </Button>
        </View>
    );
};

export const CtaGroup = smartConnect<IExternalProps>(CtaGroupComponent, [
    withTheme(stylesProvider)
]);
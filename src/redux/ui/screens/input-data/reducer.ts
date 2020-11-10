import { IScreenInputState } from './state';
import { IAction } from '../../../types';
import { TOGGLE_VALIDATOR_MULTIPLE, SELECT_INPUT, CLEAR_INPUT } from './actions';

const intialState: IScreenInputState = {};

export default (state: IScreenInputState = intialState, action: IAction): IScreenInputState => {
    switch (action.type) {
        case TOGGLE_VALIDATOR_MULTIPLE:
            const validator = action.data.validator;
            const validators = [];
            Object.assign(validators, state[action.data.screenKey]?.validators);
            const validatorIndex = validators.findIndex(v => v.id === validator.id);

            if (validatorIndex === -1) {
                // select validator
                validators.push(validator);
            } else {
                // unselect validator
                validators.splice(validatorIndex, 1);
            }

            return {
                ...state,
                [action.data.screenKey]: {
                    ...state[action.data.screenKey],
                    validators
                }
            };

        case SELECT_INPUT:
            return {
                ...state,
                [action.data.screenKey]: {
                    ...state[action.data.screenKey],
                    [action.data.inputKey]: action.data.inputData
                }
            };

        // TODO: refactor this
        case CLEAR_INPUT:
            return {
                ...state,
                [action.data.screenKey]: {
                    ...state[action.data.screenKey],
                    [action.data.inputKey]: []
                }
            };

        default:
            break;
    }
    return state;
};

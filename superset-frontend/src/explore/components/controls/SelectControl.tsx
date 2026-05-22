/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useState, useCallback, useEffect, type ReactNode } from 'react';
import { isEqualArray } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { css } from '@apache-superset/core/theme';
import { Select } from '@superset-ui/core/components';
import ControlHeader from 'src/explore/components/ControlHeader';

type SelectValue = string | number | (string | number)[] | null | undefined;

interface SelectOption {
  value: string | number;
  label: string;
  [key: string]: unknown;
}

export interface SelectControlProps {
  ariaLabel?: string;
  autoFocus?: boolean;
  choices?: [string | number, string][];
  clearable?: boolean;
  description?: string | ReactNode;
  disabled?: boolean;
  freeForm?: boolean;
  isLoading?: boolean;
  mode?: string;
  multi?: boolean;
  isMulti?: boolean;
  name: string;
  onChange?: (value: SelectValue, options?: unknown[]) => void;
  onFocus?: () => void;
  onSelect?: (value: SelectValue) => void;
  onDeselect?: (value: SelectValue) => void;
  value?: SelectValue;
  default?: SelectValue;
  showHeader?: boolean;
  optionRenderer?: (option: unknown) => ReactNode;
  valueKey?: string;
  options?: { value: string | number; label: string; [key: string]: unknown }[];
  placeholder?: string;
  filterOption?: (input: unknown, option: unknown) => boolean;
  tokenSeparators?: string[];
  notFoundContent?: ReactNode;
  label?: string;
  renderTrigger?: boolean;
  validationErrors?: string[];
  rightNode?: ReactNode;
  leftNode?: ReactNode;
  onClick?: () => void;
  hovered?: boolean;
  tooltipOnClick?: () => void;
  warning?: string;
  danger?: string;
  sortComparator?: (a: SelectOption, b: SelectOption) => number;
}

const numberComparator = (a: SelectOption, b: SelectOption): number =>
  (a.value as number) - (b.value as number);

export const areAllValuesNumbers = (
  items: unknown[],
  valueKey = 'value',
): boolean => {
  if (!items || items.length === 0) {
    return false;
  }
  return items.every(item => {
    if (Array.isArray(item)) {
      const [value] = item;
      return typeof value === 'number';
    }
    if (typeof item === 'object' && item !== null) {
      return typeof (item as Record<string, unknown>)[valueKey] === 'number';
    }
    return typeof item === 'number';
  });
};

type SortComparator =
  | ((a: SelectOption, b: SelectOption) => number)
  | undefined;

export const getSortComparator = (
  choices: unknown[] | undefined,
  options: unknown[] | undefined,
  valueKey: string | undefined,
  explicitComparator: SortComparator,
): SortComparator => {
  if (explicitComparator) {
    return explicitComparator;
  }

  if (
    (options && areAllValuesNumbers(options, valueKey)) ||
    (choices && areAllValuesNumbers(choices, valueKey))
  ) {
    return numberComparator;
  }

  return undefined;
};

export const innerGetOptions = (props: SelectControlProps): SelectOption[] => {
  const { choices, optionRenderer, valueKey = 'value' } = props;
  let options: SelectOption[] = [];
  if (props.options) {
    options = props.options.map(o => ({
      ...o,
      value: o[valueKey] as string | number,
      label: optionRenderer
        ? (optionRenderer(o) as string)
        : ((o.label || o[valueKey]) as string),
    }));
  } else if (choices) {
    options = choices.map(c => {
      if (Array.isArray(c)) {
        const [value, label] = c.length > 1 ? c : [c[0], c[0]];
        return {
          value,
          label: String(label),
        };
      }
      return { value: c as unknown as string | number, label: String(c) };
    });
  }
  return options;
};

const SelectControl: React.FC<SelectControlProps> = React.memo(
  ({
    ariaLabel,
    autoFocus = false,
    choices = [],
    clearable = true,
    description = null,
    disabled = false,
    freeForm = false,
    isLoading = false,
    label = null,
    multi = false,
    isMulti,
    name,
    onChange = () => {},
    onFocus = () => {},
    onSelect,
    onDeselect,
    showHeader = true,
    valueKey = 'value',
    value,
    default: defaultValue,
    optionRenderer,
    options: optionsProp,
    placeholder,
    filterOption,
    tokenSeparators,
    notFoundContent,
    mode,
    renderTrigger,
    rightNode,
    leftNode,
    validationErrors,
    onClick,
    hovered,
    tooltipOnClick,
    warning,
    danger,
    sortComparator,
  }) => {
    const [options, setOptions] = useState<SelectOption[]>(() =>
      innerGetOptions({
        choices,
        optionRenderer,
        valueKey,
        options: optionsProp,
        name,
      }),
    );

    useEffect(() => {
      setOptions(
        innerGetOptions({
          choices,
          optionRenderer,
          valueKey,
          options: optionsProp,
          name,
        }),
      );
    }, [choices, optionsProp, optionRenderer, valueKey, name]);

    const handleChange = useCallback(
      (val: SelectValue | SelectOption | SelectOption[]) => {
        let onChangeVal: SelectValue = val as SelectValue;

        if (Array.isArray(val)) {
          const values = val.map(v =>
            typeof v === 'object' &&
            v !== null &&
            (v as SelectOption)[valueKey] !== undefined
              ? (v as SelectOption)[valueKey]
              : v,
          );
          onChangeVal = values as (string | number)[];
        }
        if (
          typeof val === 'object' &&
          val !== null &&
          !Array.isArray(val) &&
          (val as SelectOption)[valueKey] !== undefined
        ) {
          onChangeVal = (val as SelectOption)[valueKey] as string | number;
        }
        onChange(onChangeVal, []);
      },
      [onChange, valueKey],
    );

    const handleFilterOptions = useCallback(
      (text: string, option: SelectOption) => {
        return filterOption?.({ data: option }, text) ?? true;
      },
      [filterOption],
    );

    const headerProps = {
      name,
      label,
      description,
      renderTrigger,
      rightNode,
      leftNode,
      validationErrors,
      onClick,
      hovered,
      tooltipOnClick,
      warning,
      danger,
    };

    const getValue = () => {
      const currentValue =
        value ?? (defaultValue !== undefined ? defaultValue : undefined);

      if (currentValue === null && !options.some(o => o.value === null)) {
        return undefined;
      }
      return currentValue;
    };

    const selectProps = {
      allowNewOptions: freeForm,
      autoFocus,
      ariaLabel:
        ariaLabel || (typeof label === 'string' ? label : t('Select ...')),
      allowClear: clearable,
      disabled,
      filterOption:
        filterOption && typeof filterOption === 'function'
          ? handleFilterOptions
          : true,
      header: showHeader && <ControlHeader {...headerProps} />,
      loading: isLoading,
      mode: mode || (isMulti || multi ? 'multiple' : 'single'),
      name: `select-${name}`,
      onChange: handleChange,
      onFocus,
      onSelect,
      onDeselect,
      options,
      placeholder,
      sortComparator: getSortComparator(
        choices,
        optionsProp,
        valueKey,
        sortComparator,
      ),
      value: getValue(),
      tokenSeparators,
      notFoundContent,
    };

    return (
      <div
        css={theme => css`
          .type-label {
            margin-right: ${theme.sizeUnit * 2}px;
          }
          .Select__multi-value__label > span,
          .Select__option > span,
          .Select__single-value > span {
            display: flex;
            align-items: center;
          }
        `}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Select {...(selectProps as any)} />
      </div>
    );
  },
);

export default SelectControl;

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
import { ChangeEvent, useState, useCallback, useMemo, useRef } from 'react';
import { legacyValidateNumber, legacyValidateInteger } from '@superset-ui/core';
import { debounce } from 'lodash';
import ControlHeader from 'src/explore/components/ControlHeader';
import { Constants, Input } from '@superset-ui/core/components';

type InputValueType = string | number;

export interface TextControlProps<T extends InputValueType = InputValueType> {
  name?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  isFloat?: boolean;
  isInt?: boolean;
  onChange?: (value: T, errors: any) => void;
  onFocus?: () => {};
  placeholder?: string;
  value?: T | null;
  controlId?: string;
  renderTrigger?: boolean;
  validationErrors?: string[];
  hovered?: boolean;
  showHeader?: boolean;
}

export interface TextControlState {
  value: string;
}

const safeStringify = (value?: InputValueType | null) =>
  value == null ? '' : String(value);

export default function TextControl<
  T extends InputValueType = InputValueType,
>({
  isFloat,
  isInt,
  onChange,
  onFocus,
  placeholder,
  value: propValue,
  disabled,
  label,
  ...rest
}: TextControlProps<T>) {
  const [localValue, setLocalValue] = useState(() => safeStringify(propValue));
  const prevPropValue = useRef(propValue);

  const handleChange = useCallback(
    (inputValue: string) => {
      let parsedValue: InputValueType = inputValue;
      const errors = [];
      if (inputValue !== '' && isFloat) {
        const error = legacyValidateNumber(inputValue);
        if (error) {
          errors.push(error);
        } else {
          parsedValue = inputValue.match(/.*([.0])$/g)
            ? inputValue
            : parseFloat(inputValue);
        }
      }
      if (inputValue !== '' && isInt) {
        const error = legacyValidateInteger(inputValue);
        if (error) {
          errors.push(error);
        } else {
          parsedValue = parseInt(inputValue, 10);
        }
      }
      onChange?.(parsedValue as T, errors);
    },
    [isFloat, isInt, onChange],
  );

  const debouncedOnChange = useMemo(
    () => debounce((inputValue: string) => handleChange(inputValue), Constants.FAST_DEBOUNCE),
    [handleChange],
  );

  const onChangeWrapper = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setLocalValue(value);
      debouncedOnChange(value);
    },
    [debouncedOnChange],
  );

  let displayValue = localValue;
  if (prevPropValue.current !== propValue) {
    prevPropValue.current = propValue;
    displayValue = safeStringify(propValue);
  }

  return (
    <div>
      <ControlHeader
        {...rest}
        label={label}
        disabled={disabled}
        isFloat={isFloat}
        isInt={isInt}
        onChange={onChange}
        onFocus={onFocus}
        placeholder={placeholder}
        value={propValue}
      />
      <Input
        type="text"
        data-test="inline-name"
        placeholder={placeholder}
        onChange={onChangeWrapper}
        onFocus={onFocus}
        value={displayValue}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}

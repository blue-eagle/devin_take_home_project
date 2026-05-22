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
import { useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  Row,
  Col,
  Checkbox,
  Label,
  Popover,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';

import PopoverSection from '@superset-ui/core/components/PopoverSection';
import ControlHeader from '../ControlHeader';
import SelectControl from './SelectControl';

const spatialTypes = {
  latlong: 'latlong',
  delimited: 'delimited',
  geohash: 'geohash',
} as const;

type SpatialType = (typeof spatialTypes)[keyof typeof spatialTypes];

interface SpatialValue {
  type: SpatialType;
  latCol?: string;
  lonCol?: string;
  lonlatCol?: string;
  delimiter?: string;
  reverseCheckbox?: boolean;
  geohashCol?: string;
}

interface SpatialControlProps {
  onChange?: (value: SpatialValue, errors: string[]) => void;
  value?: SpatialValue;
  animation?: boolean;
  choices?: [string, string][];
}

export default function SpatialControl({
  onChange = () => {},
  value: propValue,
  animation = true,
  choices = [],
  ...restProps
}: SpatialControlProps) {
  const v = propValue || ({} as SpatialValue);
  const defaultCol = choices.length > 0 ? choices[0][0] : undefined;

  const [type, setTypeState] = useState<SpatialType>(
    v.type || spatialTypes.latlong,
  );
  const [delimiter, setDelimiter] = useState(v.delimiter || ',');
  const [latCol, setLatCol] = useState<string | undefined>(
    v.latCol || defaultCol,
  );
  const [lonCol, setLonCol] = useState<string | undefined>(
    v.lonCol || defaultCol,
  );
  const [lonlatCol, setLonlatCol] = useState<string | undefined>(
    v.lonlatCol || defaultCol,
  );
  const [reverseCheckbox, setReverseCheckbox] = useState(
    v.reverseCheckbox || false,
  );
  const [geohashCol, setGeohashCol] = useState<string | undefined>(
    v.geohashCol || defaultCol,
  );
  const [errors, setErrors] = useState<string[]>([]);

  const fireOnChange = useCallback(() => {
    const value: SpatialValue = { type };
    const newErrors: string[] = [];
    const errMsg = t('Invalid lat/long configuration.');
    if (type === spatialTypes.latlong) {
      value.latCol = latCol;
      value.lonCol = lonCol;
      if (!lonCol || !latCol) {
        newErrors.push(errMsg);
      }
    } else if (type === spatialTypes.delimited) {
      value.lonlatCol = lonlatCol;
      value.delimiter = delimiter;
      value.reverseCheckbox = reverseCheckbox;
      if (!lonlatCol || !delimiter) {
        newErrors.push(errMsg);
      }
    } else if (type === spatialTypes.geohash) {
      value.geohashCol = geohashCol;
      value.reverseCheckbox = reverseCheckbox;
      if (!geohashCol) {
        newErrors.push(errMsg);
      }
    }
    setErrors(newErrors);
    onChange(value, newErrors);
  }, [
    type,
    latCol,
    lonCol,
    lonlatCol,
    delimiter,
    reverseCheckbox,
    geohashCol,
    onChange,
  ]);

  useEffect(() => {
    fireOnChange();
  }, [type, latCol, lonCol, lonlatCol, delimiter, reverseCheckbox, geohashCol]); // eslint-disable-line react-hooks/exhaustive-deps

  const setType = useCallback((newType: SpatialType): void => {
    setTypeState(newType);
  }, []);

  const toggleCheckbox = useCallback((): void => {
    setReverseCheckbox(prev => !prev);
  }, []);

  const stateSetters: Record<string, (val: string) => void> = {
    latCol: setLatCol,
    lonCol: setLonCol,
    lonlatCol: setLonlatCol,
    geohashCol: setGeohashCol,
    delimiter: setDelimiter,
  };

  const stateValues: Record<string, string | undefined> = {
    latCol,
    lonCol,
    lonlatCol,
    geohashCol,
    delimiter,
  };

  const renderLabelContent = (): string | null => {
    if (errors.length > 0) {
      return 'N/A';
    }
    if (type === spatialTypes.latlong) {
      return `${lonCol} | ${latCol}`;
    }
    if (type === spatialTypes.delimited) {
      return `${lonlatCol}`;
    }
    if (type === spatialTypes.geohash) {
      return `${geohashCol}`;
    }
    return null;
  };

  const renderSelect = (name: string, selectType: SpatialType): ReactNode => (
    <SelectControl
      ariaLabel={name}
      name={name}
      choices={choices}
      value={stateValues[name] as string}
      clearable={false}
      onFocus={() => {
        setType(selectType);
      }}
      onChange={(value: string) => {
        stateSetters[name]?.(value);
      }}
    />
  );

  const renderReverseCheckbox = (): ReactNode => (
    <span>
      {t('Reverse lat/long ')}
      <Checkbox checked={reverseCheckbox} onChange={toggleCheckbox} />
    </span>
  );

  const renderPopoverContent = (): ReactNode => (
    <div style={{ width: '300px' }}>
      <PopoverSection
        title={t('Longitude & Latitude columns')}
        isSelected={type === spatialTypes.latlong}
        onSelect={() => setType(spatialTypes.latlong)}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            {t('Longitude')}
            {renderSelect('lonCol', spatialTypes.latlong)}
          </Col>
          <Col xs={24} md={12}>
            {t('Latitude')}
            {renderSelect('latCol', spatialTypes.latlong)}
          </Col>
        </Row>
      </PopoverSection>
      <PopoverSection
        title={t('Delimited long & lat single column')}
        info={t(
          'Multiple formats accepted, look the geopy.points ' +
            'Python library for more details',
        )}
        isSelected={type === spatialTypes.delimited}
        onSelect={() => setType(spatialTypes.delimited)}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            {t('Column')}
            {renderSelect('lonlatCol', spatialTypes.delimited)}
          </Col>
          <Col xs={24} md={12}>
            {renderReverseCheckbox()}
          </Col>
        </Row>
      </PopoverSection>
      <PopoverSection
        title={t('Geohash')}
        isSelected={type === spatialTypes.geohash}
        onSelect={() => setType(spatialTypes.geohash)}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            {t('Column')}
            {renderSelect('geohashCol', spatialTypes.geohash)}
          </Col>
          <Col xs={24} md={12}>
            {renderReverseCheckbox()}
          </Col>
        </Row>
      </PopoverSection>
    </div>
  );

  return (
    <div>
      <ControlHeader {...restProps} />
      <Popover
        content={renderPopoverContent()}
        placement="topLeft"
        trigger="click"
      >
        <Label className="pointer">{renderLabelContent()}</Label>
      </Popover>
    </div>
  );
}

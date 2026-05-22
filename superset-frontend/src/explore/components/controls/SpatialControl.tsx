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
import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
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
}: SpatialControlProps) {
  const v = propValue || ({} as SpatialValue);
  const defaultCol = choices.length > 0 ? choices[0][0] : undefined;

  const [type, setTypeState] = useState<SpatialType>(v.type || spatialTypes.latlong);
  const [delimiter, setDelimiter] = useState(v.delimiter || ',');
  const [latCol, setLatCol] = useState(v.latCol || defaultCol);
  const [lonCol, setLonCol] = useState(v.lonCol || defaultCol);
  const [lonlatCol, setLonlatCol] = useState(v.lonlatCol || defaultCol);
  const [reverseCheckbox, setReverseCheckbox] = useState(v.reverseCheckbox || false);
  const [geohashCol, setGeohashCol] = useState(v.geohashCol || defaultCol);
  const [errors, setErrors] = useState<string[]>([]);

  const isInitialMount = useRef(true);

  const computeAndNotify = useCallback(() => {
    const spatialValue: SpatialValue = { type };
    const errs: string[] = [];
    const errMsg = t('Invalid lat/long configuration.');
    if (type === spatialTypes.latlong) {
      spatialValue.latCol = latCol;
      spatialValue.lonCol = lonCol;
      if (!lonCol || !latCol) {
        errs.push(errMsg);
      }
    } else if (type === spatialTypes.delimited) {
      spatialValue.lonlatCol = lonlatCol;
      spatialValue.delimiter = delimiter;
      spatialValue.reverseCheckbox = reverseCheckbox;
      if (!lonlatCol || !delimiter) {
        errs.push(errMsg);
      }
    } else if (type === spatialTypes.geohash) {
      spatialValue.geohashCol = geohashCol;
      spatialValue.reverseCheckbox = reverseCheckbox;
      if (!geohashCol) {
        errs.push(errMsg);
      }
    }
    setErrors(errs);
    onChange(spatialValue, errs);
  }, [type, latCol, lonCol, lonlatCol, delimiter, reverseCheckbox, geohashCol, onChange]);

  useEffect(() => {
    computeAndNotify();
  }, [computeAndNotify]);

  const setType = useCallback((newType: SpatialType) => {
    setTypeState(newType);
  }, []);

  const toggleCheckbox = useCallback(() => {
    setReverseCheckbox(prev => !prev);
  }, []);

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

  const stateSetters: Record<string, (val: string) => void> = {
    lonCol: setLonCol,
    latCol: setLatCol,
    lonlatCol: setLonlatCol,
    geohashCol: setGeohashCol,
  };

  const stateValues: Record<string, string | undefined> = {
    lonCol,
    latCol,
    lonlatCol,
    geohashCol,
  };

  const renderSelect = (name: string, spatialType: SpatialType): ReactNode => (
    <SelectControl
      ariaLabel={name}
      name={name}
      choices={choices}
      value={stateValues[name]}
      clearable={false}
      onFocus={() => {
        setType(spatialType);
      }}
      onChange={(val: string) => {
        stateSetters[name]?.(val);
      }}
    />
  );

  const renderReverseCheckbox = (): ReactNode => (
    <span>
      {t('Reverse lat/long ')}
      <Checkbox
        checked={reverseCheckbox}
        onChange={toggleCheckbox}
      />
    </span>
  );

  const popoverContent = (
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
      <ControlHeader onChange={onChange} value={propValue} animation={animation} choices={choices} />
      <Popover
        content={popoverContent}
        placement="topLeft"
        trigger="click"
      >
        <Label className="pointer">{renderLabelContent()}</Label>
      </Popover>
    </div>
  );
}

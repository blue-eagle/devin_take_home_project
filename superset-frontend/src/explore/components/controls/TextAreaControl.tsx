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
import { useCallback, useEffect, useRef } from 'react';
import { debounce } from 'lodash';
import {
  Input,
  Tooltip,
  Button,
  TextAreaEditor,
  ModalTrigger,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { withTheme } from '@apache-superset/core/theme';

import 'ace-builds/src-min-noconflict/mode-handlebars';

import ControlHeader from 'src/explore/components/ControlHeader';

interface HotkeyConfig {
  name: string;
  key: string;
  func: () => void;
}

interface ThemeType {
  colorBorder: string;
  colorBgMask: string;
  sizeUnit: number;
}

interface TextAreaControlProps {
  name?: string;
  onChange?: (value: string) => void;
  initialValue?: string;
  height?: number;
  minLines?: number;
  maxLines?: number;
  offerEditInModal?: boolean;
  language?:
    | 'json'
    | 'html'
    | 'sql'
    | 'markdown'
    | 'javascript'
    | 'handlebars'
    | null;
  aboveEditorSection?: React.ReactNode;
  readOnly?: boolean;
  resize?:
    | 'block'
    | 'both'
    | 'horizontal'
    | 'inline'
    | 'none'
    | 'vertical'
    | null;
  textAreaStyles?: React.CSSProperties;
  tooltipOptions?: Record<string, unknown>;
  hotkeys?: HotkeyConfig[];
  debounceDelay?: number | null;
  theme?: ThemeType;
  'aria-required'?: boolean;
  value?: string;
  [key: string]: unknown;
}

function TextAreaControl({
  onChange = () => {},
  height = 250,
  minLines: minLinesProp = 3,
  maxLines: maxLinesProp = 10,
  offerEditInModal = true,
  readOnly = false,
  resize = null,
  textAreaStyles = {},
  tooltipOptions = {},
  hotkeys = [],
  debounceDelay = null,
  theme,
  name,
  language,
  initialValue,
  value,
  aboveEditorSection,
  ...restProps
}: TextAreaControlProps) {
  const debouncedOnChangeRef = useRef<
    ReturnType<typeof debounce<(value: string) => void>> | undefined
  >(undefined);

  useEffect(() => {
    if (debounceDelay && onChange) {
      debouncedOnChangeRef.current = debounce(onChange, debounceDelay);
    }
    return () => {
      debouncedOnChangeRef.current?.flush();
    };
  }, [onChange, debounceDelay]);

  const handleChange = useCallback(
    (val: string | { target: { value: string } }) => {
      const finalValue = typeof val === 'object' ? val.target.value : val;
      if (debouncedOnChangeRef.current) {
        debouncedOnChangeRef.current(finalValue);
      } else {
        onChange?.(finalValue);
      }
    },
    [onChange],
  );

  const renderEditor = (inModal = false) => {
    const minLines = inModal ? 40 : minLinesProp || 12;
    if (language) {
      const style: React.CSSProperties = {
        border: theme?.colorBorder
          ? `1px solid ${theme.colorBorder}`
          : undefined,
        minHeight: `${minLines}em`,
        width: 'auto',
        ...textAreaStyles,
      };
      if (resize) {
        style.resize = resize;
        style.overflow = 'auto';
      }
      if (readOnly) {
        style.backgroundColor = theme?.colorBgMask;
      }
      const onEditorLoad = (editor: {
        commands: {
          addCommand: (cmd: {
            name: string;
            bindKey: { win: string; mac: string };
            exec: () => void;
          }) => void;
        };
      }) => {
        hotkeys?.forEach(keyConfig => {
          editor.commands.addCommand({
            name: keyConfig.name,
            bindKey: { win: keyConfig.key, mac: keyConfig.key },
            exec: keyConfig.func,
          });
        });
      };
      const codeEditor = (
        <div>
          <TextAreaEditor
            mode={language}
            style={style}
            minLines={minLines}
            maxLines={inModal ? 1000 : maxLinesProp}
            editorProps={{ $blockScrolling: true }}
            onLoad={onEditorLoad}
            defaultValue={initialValue ?? value}
            readOnly={readOnly}
            key={name}
            onChange={handleChange}
          />
        </div>
      );

      if (tooltipOptions) {
        return <Tooltip {...tooltipOptions}>{codeEditor}</Tooltip>;
      }
      return codeEditor;
    }

    const textArea = (
      <div>
        <Input.TextArea
          placeholder={t('textarea')}
          onChange={handleChange}
          defaultValue={initialValue}
          disabled={readOnly}
          style={{ height }}
          aria-required={restProps['aria-required']}
        />
      </div>
    );
    if (tooltipOptions) {
      return <Tooltip {...tooltipOptions}>{textArea}</Tooltip>;
    }
    return textArea;
  };

  const renderModalBody = () => (
    <>
      <div>{aboveEditorSection}</div>
      {renderEditor(true)}
    </>
  );

  const controlHeader = (
    <ControlHeader
      {...restProps}
      name={name}
      onChange={onChange}
      value={value}
    />
  );

  return (
    <div>
      {controlHeader}
      {renderEditor()}
      {offerEditInModal && (
        <ModalTrigger
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          modalTitle={controlHeader as any}
          triggerNode={
            <Button
              buttonSize="small"
              style={{ marginTop: theme?.sizeUnit ?? 4 }}
            >
              {t('Edit %s in modal', language)}
            </Button>
          }
          modalBody={renderModalBody()}
          responsive
        />
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default withTheme(TextAreaControl as any);

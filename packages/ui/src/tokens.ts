/** Token values are generated from tokens/easm.tokens.json; edit that file, then run `pnpm tokens`. */
export { tokens } from './tokens.generated';

export const componentNames = [
  'Button', 'IconButton', 'SplitButton', 'ButtonGroup',
  'TextField', 'PasswordField', 'NumberField', 'TextArea', 'SearchField', 'Select', 'DropdownSelect', 'Combobox', 'Checkbox', 'Radio', 'Switch', 'DateField', 'TimeField', 'FileUpload',
  'Tabs', 'SegmentedControl', 'Chip', 'Tag', 'FilterControl',
  'Badge', 'StatusBadge', 'Tooltip', 'Toast', 'Alert', 'InlineValidation', 'Progress', 'Spinner', 'Skeleton',
  'Card', 'Panel', 'Accordion', 'Collapsible', 'Divider',
  'DropdownMenu', 'Popover', 'Dialog', 'Drawer', 'ConfirmationDialog',
  'Avatar', 'UserChip', 'ModuleIcon', 'CopyControl', 'OverflowMenu',
] as const;
export type CoreComponentName = typeof componentNames[number];

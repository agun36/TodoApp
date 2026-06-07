import type { GroupBase, StylesConfig } from 'react-select'
import type { SelectOption } from './AppSelect'

export type SelectVariant = 'default' | 'compact' | 'pill'

function sizeForVariant(variant: SelectVariant) {
  if (variant === 'compact') {
    return {
      minHeight: 30,
      fontSize: '0.75rem',
      paddingY: '0.2rem',
      paddingX: '0.45rem',
    }
  }
  if (variant === 'pill') {
    return {
      minHeight: 30,
      fontSize: '0.78rem',
      paddingY: '0.15rem',
      paddingX: '0.55rem',
    }
  }
  return {
    minHeight: 40,
    fontSize: '0.875rem',
    paddingY: '0.35rem',
    paddingX: '0.65rem',
  }
}

export function createSelectStyles(
  variant: SelectVariant = 'default',
): StylesConfig<SelectOption, false, GroupBase<SelectOption>> {
  const size = sizeForVariant(variant)
  const borderRadius = variant === 'pill' ? 999 : 8

  return {
    container: (base) => ({
      ...base,
      position: 'relative',
      width: '100%',
      minWidth: 0,
    }),
    control: (base, state) => ({
      ...base,
      minHeight: size.minHeight,
      borderRadius,
      borderColor: state.isFocused ? '#6366f1' : '#e2e8f0',
      backgroundColor: variant === 'compact' ? '#f8fafc' : '#ffffff',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(99, 102, 241, 0.12)' : 'none',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
      fontSize: size.fontSize,
      '&:hover': {
        borderColor: state.isFocused ? '#6366f1' : '#cbd5e1',
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: `${size.paddingY} ${size.paddingX}`,
    }),
    singleValue: (base) => ({
      ...base,
      color: '#0f172a',
      fontWeight: variant === 'pill' ? 600 : 400,
    }),
    placeholder: (base) => ({
      ...base,
      color: '#64748b',
    }),
    input: (base) => ({
      ...base,
      color: '#0f172a',
      margin: 0,
      padding: 0,
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: '#64748b',
      padding: variant === 'compact' ? '0 4px' : '0 6px',
      transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : undefined,
      transition: 'transform 0.15s ease',
      '&:hover': { color: '#0f172a' },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: '#64748b',
      padding: '0 4px',
      '&:hover': { color: '#ef4444' },
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9000,
    }),
    menu: (base) => ({
      ...base,
      borderRadius: 8,
      border: '1px solid #e2e8f0',
      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
      overflow: 'hidden',
      marginTop: 4,
      zIndex: 9000,
    }),
    menuList: (base) => ({
      ...base,
      padding: '4px',
      maxHeight: 220,
    }),
    option: (base, state) => ({
      ...base,
      borderRadius: 6,
      fontSize: size.fontSize,
      cursor: 'pointer',
      backgroundColor: state.isSelected
        ? 'rgba(99, 102, 241, 0.12)'
        : state.isFocused
          ? '#f8fafc'
          : 'transparent',
      color: state.isSelected ? '#4f46e5' : '#0f172a',
      fontWeight: state.isSelected ? 600 : 400,
      '&:active': {
        backgroundColor: 'rgba(99, 102, 241, 0.18)',
      },
    }),
  }
}

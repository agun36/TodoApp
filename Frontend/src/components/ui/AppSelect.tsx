import { useId, useLayoutEffect, useState } from 'react'
import Select from 'react-select'
import { createSelectStyles, type SelectVariant } from './selectStyles'

export interface SelectOption {
  value: string
  label: string
}

interface AppSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  isDisabled?: boolean
  placeholder?: string
  isClearable?: boolean
  'aria-label'?: string
  inputId?: string
  variant?: SelectVariant
  className?: string
}

export function AppSelect({
  value,
  onChange,
  options,
  isDisabled = false,
  placeholder,
  isClearable = false,
  'aria-label': ariaLabel,
  inputId,
  variant = 'default',
  className,
}: AppSelectProps) {
  const autoId = useId()
  const resolvedInputId = inputId ?? autoId.replace(/:/g, '')
  const [menuPortalTarget, setMenuPortalTarget] = useState<HTMLElement | null>(null)
  const selected = options.find((option) => option.value === value) ?? null

  useLayoutEffect(() => {
    setMenuPortalTarget(document.body)
  }, [])

  return (
    <div className={className ? `app-select-wrap ${className}` : 'app-select-wrap'}>
      <Select<SelectOption, false>
        classNamePrefix="app-select"
        inputId={resolvedInputId}
        aria-label={ariaLabel}
        value={selected}
        onChange={(option) => onChange(option?.value ?? '')}
        options={options}
        isDisabled={isDisabled}
        isClearable={isClearable}
        placeholder={placeholder}
        isSearchable={options.length > 8}
        styles={createSelectStyles(variant)}
        menuPlacement="auto"
        menuPortalTarget={menuPortalTarget}
        menuPosition="fixed"
        menuShouldScrollIntoView
        closeMenuOnScroll
        blurInputOnSelect
      />
    </div>
  )
}

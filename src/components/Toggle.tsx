import React, { ComponentProps, ReactElement } from 'react'

export interface ToggleProps extends Omit<ComponentProps<'input'>, 'ref' | 'type'> {
    updateValue?: React.Dispatch<React.SetStateAction<boolean>>
    label?: string
    icon?:ReactElement
}

export default function Toggle({label, updateValue, icon, checked, className}: ToggleProps) {
  return (
    <label className={`relative inline-flex items-center text-center cursor-pointer ${className}`}>
        <input type="checkbox" onChange={(e) => updateValue?.(e.currentTarget.checked)} checked={checked} className="sr-only peer"/>
        <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">{label}</span>
        {icon}
    </label>
  )
}
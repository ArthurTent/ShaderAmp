import React, { ComponentProps, useId, useRef } from 'react'

export interface RangeSliderProps extends Omit<ComponentProps<'input'>, 'ref' | 'type'> {
    updateValue?: React.Dispatch<React.SetStateAction<number>>
    label?: string
}

export default function RangeSlider({updateValue, label, ...props}: RangeSliderProps) {
    const id = useId(); 
    const handleChangeEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (updateValue) {
            console.log(`[Slider] updatevalue: `, updateValue);
            updateValue(e.currentTarget.valueAsNumber);
        }
    }
    return (
        <div className="p-1">
            { label && 
                <label
                    htmlFor={id}
                    className="mb-2 inline-block text-neutral-700 dark:text-neutral-200">
                    {label}: {props.value}
                </label>
            }
            <input className="w-full accent-indigo-600" 
                id={id}
                type="range"
                onChange={handleChangeEvent}
                {...props}/>
            { (props.min ?? props.max) && <>
                <div className="-mt-2 flex w-full justify-between">
                    <span className="text-sm text-gray-600">{props.min}</span>
                    <span className="text-sm text-gray-600">{props.max}</span>
                </div>
            </>}
        </div>
    )
}
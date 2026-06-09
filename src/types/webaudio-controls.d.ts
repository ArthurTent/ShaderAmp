declare namespace JSX {
    interface IntrinsicElements {
        'webaudio-knob': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
            min?: string | number;
            max?: string | number;
            step?: string | number;
            value?: string | number;
            defvalue?: string | number;
            diameter?: string | number;
            width?: string | number;
            height?: string | number;
            src?: string;
            sprites?: string | number;
            sensitivity?: string | number;
            valuetip?: string | number;
            tooltip?: string;
            conv?: string;
            log?: string | number;
            outline?: string | number;
            enable?: string | number;
            colors?: string;
            fontsize?: string | number;
            fontcolor?: string;
            id?: string;
        };
        'webaudio-slider': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
            min?: string | number;
            max?: string | number;
            step?: string | number;
            value?: string | number;
            defvalue?: string | number;
            direction?: 'vert' | 'horz';
            width?: string | number;
            height?: string | number;
            src?: string;
            knobsrc?: string;
            knobwidth?: string | number;
            knobheight?: string | number;
            basewidth?: string | number;
            baseheight?: string | number;
            ditchLength?: string | number;
            sensitivity?: string | number;
            valuetip?: string | number;
            tooltip?: string;
            conv?: string;
            log?: string | number;
            outline?: string | number;
            enable?: string | number;
            colors?: string;
            fontsize?: string | number;
            fontcolor?: string;
            tracking?: 'rel' | 'abs';
            id?: string;
        };
        'webaudio-switch': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
            value?: string | number;
            defvalue?: string | number;
            type?: 'toggle' | 'kick' | 'radio';
            width?: string | number;
            height?: string | number;
            diameter?: string | number;
            src?: string;
            group?: string;
            invert?: string | number;
            tooltip?: string;
            outline?: string | number;
            enable?: string | number;
            colors?: string;
            fontsize?: string | number;
            fontcolor?: string;
            id?: string;
        };
        'webaudio-param': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
            link?: string;
            value?: string | number;
            width?: string | number;
            height?: string | number;
            fontsize?: string | number;
            fontcolor?: string;
            src?: string;
            conv?: string;
            rconv?: string;
            outline?: string | number;
            enable?: string | number;
            id?: string;
        };
    }
}

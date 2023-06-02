/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/semi */



export type ConsoleMessageT = {
    id: number,
    consoleId: number,
    threadName:string,
    callingThreadName:string,
    callingThreadColor:string,
    type: string,
    threadColor:string,
    msg: string,
    when: Date,
    obj:any
};


// connect
// reconnect
// disconnect
// login_fail
export type SockGenericFunctionT = (
    ) => void;

// internal_error
// connect_error
export type SockMessageFunctionT = (
    message:string
) => void;


export type SockCallbacksT = {
    connect?: Function,
    connected?: Function,
    disconnect?: Function,
    telemetry?: Function,

};

export type WebsocketT = {
    _name: string,
    _created: Date,
    _serverAuthToken:string,
    _dead: boolean,
    on?: Function,
    emit?:Function,
    send?:Function,
    onerror?: Function,
    disconnect?:Function,
    readyState?: any,
    OPEN?: any
};

export type WebsocketMapT = {
    [name:string]: WebsocketT
};

export type ValueRefT = {
    ref: string;
}










export type PrintableContentT = {
    htmlOutput?: string,
    stringOutput?: string,
    stringType?: string
}


export type TabDataFieldColorT = {
    fg?:string,
    bg?:string
};

export type TabDataFieldT = {
    icon?: string,
    hidden?: boolean,
    color?: string | TabDataFieldColorT | ((data)=>TabDataFieldColorT),
    style?: Object,
    titleStyle?: Object,
    height?: string,
    type?: string,  // date, when, number, float, integer, object, boolean
    title?: string,
    squeeze?: boolean, // do not compress/squeeze this column
    //render?: RenderFunctionT,  // for client side rendering

};

export type TabDataFieldMapT = {
    [fieldName:string]: TabDataFieldT
};







export type ChatCommandT = {
    command: string,
    data: any,
    handle:string
}

export type ChatCommandReplyT = {
    info: string,
    data: any,
    error: string,
    handle: string
}


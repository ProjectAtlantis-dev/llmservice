/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/semi */


// buffered and colored console logging
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


// below websocket stuff is socket io stuff (Server.ts and SockClient.ts)

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

// these are only used in context of websocket stuff
export type RequestT = {
    handle: string,
    command: string,
    data: any
}

export type ReplyT = {
    handle: string,
    data: any,
    error: string
}









// used for JSON and tabular output
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




// LLM specific stuff

// from browser
export type MessageT = {
    message: string,
    hostId: string,  // browser id
    clientType: string
    clientId: string,
    service: string,
    model: string,

    requestId: string,

    data: string
}

export type LLMRequestMapItemT = {
    mode: string,
    callback: Function,
    lastSeen: Date,
    completion: string
}
export type LLMRequestMapT = {
    [clientId:string]: LLMRequestMapItemT
}


// browser client
export type ClientT = {
    clientId: string,
    service: string,
    model: string,

    hostId: string,
    clientType: string,

    lastSeen: Date,
    status: string,

    // for conversation stuff
    requestMap: LLMRequestMapT
}

export type ClientMapT = {
    [clientId:string]:ClientT
}


// LLM conversation stuff

export type LLMRequestT = {
    service: string,
    model: string,
    prompt: string
}

export type MiniRequestT = {
    clientId: string,
    data: string
}


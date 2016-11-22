import * as Rx from 'rx';

import {byTag, sendAction} from 'rx-bytag';
Rx.Observable.prototype.byTag = byTag;

import * as bareConstants from './constants';
import {applyMiddleware} from './middleware';

var mtag = (...args1) => (...args2) => (...args3) =>
    args1.concat(args2, args3).join('/');

/**
Usage:
    var myapp = getRSV({
        appID: 'myapp',
        defaultRoute: '...',
    });

    var {Dispatcher, send} = myapp;
**/
export function getRSV(config = {}) {
    var {appID} = config;

    var tag = mtag(appID);

    var C = Object.keys(bareConstants).reduce(function(acc, key) {
        acc[key] = tag('core')(bareConstants[key]);
        return acc;
    }, {});

    var Actions = config.Actions || new Rx.Subject();
    Actions.onCompleted = () => {}; // Never complete.

    var send = sendAction.bind(Actions);

    var Dispatcher = Actions
        .asObservable() // The dispatcher is read-only.
        .publish(applyMiddleware(C))
        .share();

    var register = modConf => send(tag(modConf.modID)('register', 'new'))(modConf);

    function getLogger(name) {
        var logger = (level, message) =>
            send(tag(name)('log', level))({message});

        var levels = [
            'critical',
            'error',
            'warning',
            'info',
            'debug',
        ];

        return levels.reduce(function(acc, level) {
            acc[level] = (...args) => logger(level, ...args);
            return acc;
        }, {});
    }

    return {
        C,
        constants: C,
        Actions,
        Dispatcher,
        tag,
        send,
        register,
        getLogger,
    };
}

import * as at from 'lodash/at';
import * as isArray from 'lodash/isArray';
import * as isFunction from 'lodash/isFunction';

import * as toposort from 'toposort';

import * as C from './constants';

var sep = '_|-';

/**
Create a single, sequential observable stream out of other streams

Usage:

    var Actions = new Rx.Subject();
    var Dispatcher = Actions
        .asObservable()
        .publish(applyMiddleware)
        .share();

Expects a register event containing middleware in the following format:

    {
        middleware: {
            notFoo: o => o.filter(x => x.tag !== 'foo'),
            notBaz: {
                fn: o => o.filter(x => x.tag !== 'baz'),
                after: ['notFoo'],
            },
            notBar: {
                fn: o => o.filter(x => x.tag !== 'bar'),
                after: ['notFoo'],
                before: ['notBaz'],
            },
        },
    }

The key is the name of each middleware. The value is either a function or an
object containing a `fn` param as well as optional paramteters used in the
topological sort.
**/
export function applyMiddleware(C) {
    return function applyNamespacedMiddleware(o) {
        var middleware = o
            .filter(isRegisterMiddleware)
            .scan((acc, {tag, data}) => tag === C.REGISTER
                ? add(acc, data)
                : remove(acc, data), {})
            .map(sortMWByDeps);

        return o
            .filter(isRegisterMiddleware)
            .withLatestFrom(middleware, function(evt, mw) {
                var mwArray = mw.map(x => x.fn);
                return mwArray.reduce((acc, cur) =>
                    acc.let(cur), o).startWith(evt);
            })
            .startWith(o.filter(x => !isRegisterMiddleware(x)))
            .switch();
    };

    function isRegisterMiddleware({tag, data}) {
        var ret = (tag === C.REGISTER && data && data.middleware)
            || tag === C.UNREGISTER;
        return ret;
    }
}

/**
Add or remove middleware to an accumulation dictionary

The returned objects are in form:

    {
        mw: Object // the individual middleware functions, namespaced by module
            ID and middleware name, and associated module data.
        mw.modID: string // the module ID this middleware is from.
        mw.name: string // the middleware name
        mw.fn: function // the middleware
        mw.before: Array // reverse dependencies; this function should run
            before the listed middleware (should be added as a dependency to
            them).
        mw.after: Array // dependencies; this function should run after the
            listed middleware.
    }

Out: ...{mwID: {name, modID, fn, [before], [after]}}
**/
function add(acc, data) {
    return Object.keys(data.middleware).reduce(function(newMW, name) {
        var mwObj = data.middleware[name];
        var mw = isFunction(mwObj) ? {fn: mwObj} : mwObj;
        newMW[`${data.modID}${sep}${name}`] = Object.assign({}, mw, {
            modID: data.modID,
            name,
        });
        return newMW;
    }, acc);
}

function remove(acc, data) {
    return Object.keys(acc).reduce(function(newMW, name) {
        var mw = acc[name];
        if (mw.modID !== data.modID) {
            newMW[name] = mw;
        }
        return newMW;
    }, {});
}

/**
Run a topological sort to produce a correctly ordered pipeline of middleware

In: ...{mwID: {name, modID, fn, [before], [after]}}
Out: [...{name, modID, fn, [before], [after]}]
**/
export function sortMWByDeps(mwObj) {
    var nodes = Object.keys(mwObj),
        edges = [];

    Object.keys(mwObj).map(function(name) {
        var mw = mwObj[name];

        if (mw.before) {
            edges.push(...mw.before.map(function(revDep) {
                var before = isArray(revDep)
                    ? revDep.join(sep)
                    : `${mw.modID}${sep}${revDep}`;

                return [before, name];
            }));
        }

        if (mw.after) {
            edges.push(...mw.after.map(function(dep) {
                var after = isArray(dep)
                    ? dep.join(sep)
                    : `${mw.modID}${sep}${dep}`;

                return [name, after];
            }));
        }
    });

    var sortedNames = toposort.array(nodes, edges).reverse();
    return at(mwObj, sortedNames);
}

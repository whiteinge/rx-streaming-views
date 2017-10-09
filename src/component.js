import * as _ from 'lodash';
import * as Rx from 'rx';

import * as React from 'react';
import {PropTypes} from 'prop-types';

/**
Wrapper component to make an observable available via React context

This allows children to tie their internal subscription lifecycles to an
observable that lives higher up in the app (like a routing observable).

Dispatcher
    .byTag(C.VIEW)
    .scan(model)
    .let(function(o) {
        var Counters = CounterMediator({ns: 'testing'});

        return o.map(() => h(Connectable, {o}, h('div', [
            h('p', 'This is a demo of SCT-ies'),
            h(Counters),
        ])));
    });

**/
export class Connectable extends React.Component {
    render() {
        return React.Children.only(this.props.children);
    }
}

Connectable.propTypes = {
    o: PropTypes.instanceOf(Rx.Observable).isRequired,
};

/**
Connect an observable stream with a stateless functional component

`component` is a React component that only responds to stream updates unless
`allowProps` is given which might be useful for compat with third-party
components.

`events` is an object of Rx streams that emit internal information intended for
public consumption by other, external, streams.

`actions` are useful for affecting internal change from other, external, code.

var makeCounter = connect(counterStore)(counterView);
var {
    component: Counter,
    events: CounterEvents,
    actions: CounterActions,
} = makeCounter({ns: 'foo/bar'});
**/
export function connect(streams) {
    return function(view) {
        return function(opts = {}) {
            var ns = opts.ns || Math.random().toString(36).slice(2);
            var allowProps = opts.allowProps || false;
            var u = {Dispatcher, send, sendTag, sendForm, evt, tag: tag(ns)};

            return wrapSFCinPR(
                streams(u, {ns, ...opts}),
                view,
                allowProps);
        };
    };
}

/**
Wrap a stateless functional component within a PureComponent

Call render whenever the associated observable stream produces values.
**/
function wrapSFCinPR(streams, WrappedComponent, allowProps) {
    var displayName = `Connect(${getDisplayName(WrappedComponent)})`;
    var {store, events = {}, actions = {}, tasks = [], ...rest} = streams;
    store = _.isFunction(store) ? Rx.Observable.create(store) : store;

    /* eslint-disable react/display-name, no-shadow */
    class BaseConnect extends React.Component {
        constructor(props) {
            super(props);
        }

        componentDidMount() {
            this._sub = Rx.Observable.using(
                () => new Rx.CompositeDisposable(
                    store.subscribe(this.subFn.bind(this)),
                    ..._.map(tasks, x =>
                        x.subscribe(({tag, data}) => sendTag(tag, data)))),
                () => currentViewOb)
            .subscribe();
        }

        componentWillUnmount() {
            this._sub.dispose();
        }
    }

    class ConnectNoProps extends BaseConnect {
        constructor(props) {
            super(props);
            this.renderVal = null;
        }

        // The only thing that triggers renders is the stream,
        // and the stream only emits when there should be a render.
        shouldComponentUpdate() { return false; }

        subFn(x) {
            this.renderVal = x;
            this.forceUpdate();
        }

        render() {
            if (this.renderVal == null) { return null; }
            return h(WrappedComponent, this.renderVal);
        }
    }

    class ConnectProps extends BaseConnect {
        constructor(props) {
            super(props);
        }

        subFn(x) {
            this.setState(x);
        }

        render() {
            if (_.isEmpty(this.state)) { return false; }
            return h(WrappedComponent, {
                ...this.props,
                ...this.state,
                ...rest,
            });
        }
    }
    /* eslint-enable react/display-name, no-shadow */

    var Connect = allowProps ? ConnectProps : ConnectNoProps;
    Connect.displayName = displayName;
    return {
        component: Connect,
        events,
        actions,
    };
}

function getDisplayName(WrappedComponent) {
    return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

# react-native-flipper-xstate

This packages allows Android and iOS apps to use the [Flipper-plugin-xstate](https://github.com/cpetzel/flipper-plugin-xstate) plugin to visualize and interact with their [xstate](https://xstate.js.org/docs/) machines.

![Xstate Viz](static/xstate-viz-rn.gif?raw=true "Xstate Viz")

### Dependencies

This package depends on the native package [React Native Flipper](https://github.com/facebook/flipper/tree/main/react-native/react-native-flipper), so you will have to recompile the native apps before using this plugin.

## Usage

To use, simply import and call the `inspect` function at the root of your project (index.js) You will only want to do this in Debug/Dev builds.

```js
import { inspect } from "react-native-flipper-xstate";

if (__DEV__) {
  inspect();
}
```

You also must specify the `devTools` option when creating your machines. Here is an example using the `useMachine` hook.

```js
const [current, send] = createMachine(machine, { devTools: true });
```

## Todo

- Get Typescript to work

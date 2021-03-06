/*
* Copyright (c) 2019 Software AG, Darmstadt, Germany and/or its licensors
*
* SPDX-License-Identifier: Apache-2.0
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
 */

import {DeviceSimulator} from "./device-simulator";
import {SimulationStrategyMetadata} from "./simulation-strategy.decorator";
import { Type } from "@angular/core";
import { SimulatorConfig } from "./simulator-config";

// Provided by the polyfills.ts - import '@angular-devkit/build-angular/src/angular-cli-files/models/jit-polyfills.js';
declare module Reflect {
    function getMetadata(name: string, target: any);
}

export abstract class SimulationStrategyConfigComponent {
    abstract config: any;

    abstract initializeConfig(): void
}

export abstract class SimulationStrategyFactory<T extends DeviceSimulator = DeviceSimulator> {
    abstract createInstance(config: SimulatorConfig): T;

    abstract getSimulatorClass(): Type<T>;

    getSimulatorMetadata(): SimulationStrategyMetadata {
        return Reflect.getMetadata('simulationStrategy', this.getSimulatorClass())[0] as SimulationStrategyMetadata;
    }
}

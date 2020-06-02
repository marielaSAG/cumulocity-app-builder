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
import {Component, Inject, OnDestroy} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Subscription} from "rxjs";
import {ContextDashboardType} from "@c8y/ngx-components/context-dashboard";
import { InventoryService, ApplicationService, UserService } from "@c8y/client";
import {last} from "lodash-es";
import {SMART_RULES_AVAILABILITY_TOKEN} from "./smartrules/smart-rules-availability.upgraded-provider";
import {IApplicationBuilderApplication} from "../iapplication-builder-application";
import {AppStateService} from "@c8y/ngx-components";
import {RuntimeWidgetInstallerModalService} from "cumulocity-runtime-widget-loader";

@Component({
    selector: 'app-builder-context-dashboard',
    template: `
        <c8y-tab *ngFor="let tab of tabs" [icon]="tab.icon" [label]="tab.label" [path]="tab.path"
                 [priority]="tab.priority"></c8y-tab>

        <ng-container [ngSwitch]="deviceDetail">
            <legacy-smart-rules *ngSwitchCase="'smartrules'"></legacy-smart-rules>
            <legacy-alarms *ngSwitchCase="'alarms'"></legacy-alarms>
            <legacy-data-explorer *ngSwitchCase="'data_explorer'"></legacy-data-explorer>
            <ng-container *ngSwitchDefault>
                <c8y-action-bar-item priority="0" placement="more" *ngIf="hasAdminRights()">
                    <li>
                        <button (click)="showInstallModal()"><i c8yIcon="upload"></i> Install widget</button>
                    </li>
                </c8y-action-bar-item>
                <ng-container [ngSwitch]="isGroupTemplate">
                    <dashboard-by-id *ngSwitchCase="false" [dashboardId]="dashboardId" [context]="context"
                                     [disabled]="disabled"></dashboard-by-id>
                    <group-template-dashboard *ngSwitchCase="true" [dashboardId]="dashboardId" [deviceId]="this.deviceId" [context]="context"
                                     [disabled]="disabled"></group-template-dashboard>
                    <ng-container *ngSwitchCase="undefined"><!--Loading--></ng-container>
                </ng-container>
            </ng-container>
        </ng-container>
    `
})
export class AppBuilderContextDashboardComponent implements OnDestroy {
    applicationId: string;
    dashboardId: string;
    tabGroup?: string
    deviceId?: string
    deviceDetail?: string

    isGroupTemplate?: boolean;

    context: Partial<{
        id: string,
        name: string,
        type: ContextDashboardType
    }> = {}

    disabled = true;

    tabs: {
        label: string,
        icon: string,
        path: string,
        priority: number
    }[] = [];

    subscriptions = new Subscription();

    constructor(
        private activatedRoute: ActivatedRoute,
        private inventoryService: InventoryService,
        private applicationService: ApplicationService,
        @Inject(SMART_RULES_AVAILABILITY_TOKEN) private c8ySmartRulesAvailability: any,
        private userService: UserService,
        private appStateService: AppStateService,
        private runtimeWidgetInstallerModalService: RuntimeWidgetInstallerModalService
    ) {
        this.subscriptions.add(this.activatedRoute.paramMap.subscribe(async paramMap => {
            // Always defined
            this.applicationId = paramMap.get('applicationId');
            this.dashboardId = paramMap.get('dashboardId')
            // Optional
            this.tabGroup = paramMap.get('tabGroup');
            this.deviceId = paramMap.get('deviceId');
            this.deviceDetail = paramMap.get('deviceDetail');

            this.context = {
                id: this.deviceId
            }

            this.isGroupTemplate = undefined;

            // The user may have simulator access (INVENTORY_ADMIN)
            // but we don't necessarily want them messing with the dashboards unless they have app edit permissions
            // A security hole but not a major one
            this.disabled = !userService.hasAllRoles(appStateService.currentUser.value, ["ROLE_INVENTORY_ADMIN","ROLE_APPLICATION_MANAGEMENT_ADMIN"]);

            // TODO: check to see if applicationId + dashboardId/tabGroup has changed we don't need to reset the tabs if they haven't - it'll stop the flashing

            const tabs = [];
            this.tabs = tabs;
            if (this.deviceId) {
                if (this.c8ySmartRulesAvailability.shouldShowLocalSmartRules()) {
                    tabs.push({
                        label: 'Smart rules',
                        icon: 'asterisk',
                        priority: 3,
                        path: this.createDeviceTabPath(this.dashboardId, 'smartrules')
                    })
                }
                tabs.push({
                    label: 'Alarms',
                    icon: 'bell',
                    priority: 2,
                    path: this.createDeviceTabPath(this.dashboardId, 'alarms')
                }, {
                    label: 'Data explorer',
                    icon: 'bar-chart',
                    priority: 1,
                    path: this.createDeviceTabPath(this.dashboardId, 'data_explorer')
                });
            }

            const app = (await this.applicationService.detail(this.applicationId)).data as IApplicationBuilderApplication;
            const dashboard = app.applicationBuilder.dashboards
                .find(dashboard => dashboard.id === this.dashboardId);

            if (!dashboard) {
                console.warn(`Dashboard: ${this.dashboardId} isn't part of application: ${this.applicationId}`);
            }

            if (this.tabGroup) {
                const dashboardsInTabgroup = app.applicationBuilder.dashboards
                    .filter(dashboard => dashboard.tabGroup === this.tabGroup && dashboard.visibility !== 'hidden')
                tabs.push(...dashboardsInTabgroup.map((dashboard, i) => ({
                    label: last(dashboard.name.split(/[/\\]/)),
                    icon: dashboard.icon,
                    priority: dashboardsInTabgroup.length - i + 1000,
                    path: this.createTabGroupTabPath(dashboard.id)
                })));
            }
            if (this.deviceId && !this.tabGroup) {
                if (dashboard) {
                    tabs.push({
                        label: last(dashboard.name.split(/[/\\]/)),
                        icon: dashboard.icon,
                        priority: 1000,
                        path: this.createDeviceTabPath(dashboard.id)
                    });
                } else {
                    // If for some reason the user has navigated to a dashboard that isn't part of the app then add the tab anyway
                    tabs.push({
                        label: 'Dashboard',
                        icon: 'th',
                        priority: 1000,
                        path: this.createDeviceTabPath(this.dashboardId)
                    });
                }
            }

            this.isGroupTemplate = (dashboard && dashboard.groupTemplate) || false;
        }));
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    createDeviceTabPath(dashboardId: string, deviceDetail?: string) {
        let path = `/application/${this.applicationId}`;
        if (this.tabGroup) {
            path += `/tabgroup/${this.tabGroup}`;
        }
        path += `/dashboard/${dashboardId}`;
        path += `/device/${this.deviceId}`;
        if (deviceDetail) {
            path += `/${deviceDetail}`;
        }
        return path;
    }

    createTabGroupTabPath(dashboardId: string) {
        let path = `/application/${this.applicationId}`;
        path += `/tabgroup/${this.tabGroup}`;
        path += `/dashboard/${dashboardId}`;
        if (this.deviceId) {
            path += `/device/${this.deviceId}`
        }
        return path;
    }

    showInstallModal() {
        this.runtimeWidgetInstallerModalService.show();
    }

    hasAdminRights() {
        return this.userService.hasAllRoles(this.appStateService.currentUser.value, ["ROLE_INVENTORY_ADMIN","ROLE_APPLICATION_MANAGEMENT_ADMIN"]);
    }
}

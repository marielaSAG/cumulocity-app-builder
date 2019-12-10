import {Component, OnInit, ViewChild} from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import {ApplicationService, ApplicationAvailability, ApplicationType, InventoryService} from '@c8y/client';
import {AppStateService} from "@c8y/ngx-components";
import {WizardComponent} from "../../wizard/wizard.component";
import {DashboardNavigation} from "../dashboard.navigation";
import {WELCOME_DASHBOARD_TEMPLATE} from "./dashboard-templates";

@Component({
    templateUrl: './new-dashboard-modal.component.html'
})
export class NewDashboardModalComponent {
    busy = false;

    creationMode: 'blank' | 'template' | 'existing' | 'clone' = 'blank';

    dashboardId: string = '12598412';
    dashboardName: string = '';
    dashboardIcon: string = 'th';

    dashboardTemplate: 'welcome' = 'welcome';

    app: any;

    @ViewChild(WizardComponent) wizard: WizardComponent;

    constructor(public bsModalRef: BsModalRef, private appService: ApplicationService, private inventoryService: InventoryService, private navigation: DashboardNavigation) {}

    showId() {
        switch(this.creationMode) {
            case "existing":
            case "clone":
                return true;
            default: return false;
        }
    }

    async createDashboard() {
        this.busy = true;
        switch(this.creationMode) {
            case "blank": {
                await this.addNewDashboard(this.app, this.dashboardName, this.dashboardIcon);
                break;
            }
            case "template": {
                await this.addTemplateDashboardByTemplateName(this.app, this.dashboardName, this.dashboardIcon, this.dashboardTemplate);
                break;
            }
            case "existing": {
                await this.addExistingDashboard(this.app, this.dashboardName, this.dashboardId, this.dashboardIcon);
                break;
            }
            case "clone": {
                await this.addClonedDashboard(this.app, this.dashboardName, this.dashboardId, this.dashboardIcon);
                break;
            }
            default: {
                throw Error(`Unknown dashboard creation mode: ${this.creationMode}`);
            }
        }
        this.bsModalRef.hide()
    }

    async addClonedDashboard(application, name: string, dashboardId: string, icon: string) {
        const dashboardManagedObject = (await this.inventoryService.detail(dashboardId)).data;

        const template = dashboardManagedObject.c8y_Dashboard;

        await this.addTemplateDashboard(application, name, icon, template);
    }

    async addExistingDashboard(application, name: string, dashboardId: string, icon: string) {
        application.applicationBuilder.dashboards = [
            ...application.applicationBuilder.dashboards || [],
            {
                id: dashboardId,
                name,
                icon
            }
        ];
        await this.appService.update({
            id: application.id,
            applicationBuilder: application.applicationBuilder
        } as any);

        this.navigation.refresh();
    }

    async addNewDashboard(application, name: string, icon: string) {
        await this.addTemplateDashboard(application, name, icon, {
            children: {},
            name,
            icon,
            global: true,
            priority: 10000
        });
    }

    async addTemplateDashboardByTemplateName(application, name: string, icon: string, templateName: 'welcome') {
        const template = {
            'welcome': WELCOME_DASHBOARD_TEMPLATE
        }[templateName];

        await this.addTemplateDashboard(application, name, icon, template);
    }

    async addTemplateDashboard(application, name: string, icon: string, template: any) {
        const dashboardManagedObject = (await this.inventoryService.create({
            "c8y_Dashboard": {
                ...template,
                name,
                icon,
                "global": true
            }
        })).data;
        application.applicationBuilder.dashboards = [
            ...application.applicationBuilder.dashboards || [],
            {
                id: dashboardManagedObject.id,
                name,
                icon
            }
        ];
        await this.appService.update({
            id: application.id,
            applicationBuilder: application.applicationBuilder
        } as any);

        this.navigation.refresh();
    }
}
import { LightningElement, wire, track, api } from "lwc";

import { updateRecord } from "lightning/uiRecordApi";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { refreshApex } from "@salesforce/apex";
import getBoats from "@salesforce/apex/BoatDataService.getBoats";
import BOATMC from "@salesforce/messageChannel/BoatMessageChannel__c";
import {
  MessageContext,
  publish,
  APPLICATION_SCOPE
} from "lightning/messageService";

// ...
export default class BoatSearchResults extends LightningElement {
  @track selectedBoatId;
  columns = [
    { label: "Name", fieldName: "Name", editable: true },
    {
      label: "Length",
      fieldName: "Length__c",
      type: "number",
      editable: true
    },
    {
      label: "Price",
      fieldName: "Price__c",
      type: "currency",
      typeAttributes: { maximumFractionDigits: "2" },
      editable: true
    },
    {
      label: "Description",
      fieldName: "Description__c",
      editable: true
    }
  ];
  boatTypeId = "";
  @track boats;
  isLoading = false;
  @track draftValues = [];

  // wired message context
  @wire(MessageContext) messageContext;

  @wire(getBoats, { boatTypeId: "$boatTypeId" })
  wiredBoats({ data, error }) {
    if (data) {
      this.boats = data;
    } else if (error) {
      this.boats = null;
    }
  }

  // public function that updates the existing boatTypeId property
  // uses notifyLoading
  @api
  searchBoats(boatTypeId) {
    this.notifyLoading(true);
    this.boatTypeId = boatTypeId;
    this.notifyLoading(false);
  }

  // this public function must refresh the boats asynchronously
  // uses notifyLoading
  @api
  async refresh() {
    this.notifyLoading(true);
    await refreshApex(this.boats);
    this.notifyLoading(false);
  }

  // this function must update selectedBoatId and call sendMessageService
  updateSelectedTile(event) {
    this.selectedBoatId = event.detail.boatId;
    this.sendMessageService(this.selectedBoatId);
  }

  // Publishes the selected boat Id on the BoatMC.
  sendMessageService(boatId) {
    publish(
      this.messageContext,
      BOATMC,
      { recordId: boatId },
      { scope: APPLICATION_SCOPE }
    );
  }

  // This method must save the changes in the Boat Editor
  // Show a toast message with the title
  // clear lightning-datatable draft values
  handleSave(event) {
    const recordInputs = event.detail.draftValues.slice().map((draft) => {
      const fields = Object.assign({}, draft);
      return { fields };
    });
    const promises = recordInputs.map((recordInput) =>
      //update boat record
      updateRecord(recordInput)
    );
    Promise.all(promises)
      .then(() => {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Success",
            message: "Ship It!",
            variant: "success"
          })
        );

        this.draftValues = [];
        this.refresh();
      })
      .catch((error) => {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Error",
            message: error.body.message,
            variant: "error"
          })
        );
      })
      .finally(() => {});
  }
  // Check the current value of isLoading before dispatching the doneloading or loading custom event
  notifyLoading(isLoading) {
    this.isLoading = isLoading;
    if (isLoading) {
      this.dispatchEvent(new CustomEvent("loading"));
    } else {
      this.dispatchEvent(new CustomEvent("doneloading"));
    }
  }
}

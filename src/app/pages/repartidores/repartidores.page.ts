import { Component, inject } from '@angular/core';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';

@Component({
  selector: 'app-repartidores-page',
  imports: [],
  templateUrl: './repartidores.page.html',
})
export class RepartidoresPage {
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);
  constructor() {
    this.operations.view.set('Repartidores');
  }
}

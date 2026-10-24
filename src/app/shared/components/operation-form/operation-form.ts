import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../../core/services/operations.service';
import { OperationFormsService } from '../../../core/services/operation-forms.service';
import { ZoneMapPicker } from '../zone-map-picker/zone-map-picker';
import { AddressPicker } from '../address-picker/address-picker';
@Component({
  selector: 'app-operation-form',
  imports: [FormsModule, AddressPicker, ZoneMapPicker],
  templateUrl: './operation-form.html',
})
export class OperationForm {
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);
}

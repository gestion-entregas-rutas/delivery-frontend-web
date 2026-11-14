import { Component, inject } from '@angular/core';
import { OperationsService } from '../../../core/services/operations.service';
@Component({
  selector: 'app-operation-metrics',
  imports: [],
  templateUrl: './operation-metrics.html',
})
export class OperationMetrics {
  readonly operations = inject(OperationsService);
}

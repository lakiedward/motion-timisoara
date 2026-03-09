import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  MatFormFieldModule
} from "./chunk-3O73V76Y.js";
import {
  MAT_ERROR,
  MAT_FORM_FIELD,
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MAT_PREFIX,
  MAT_SUFFIX,
  MatError,
  MatFormField,
  MatFormFieldControl,
  MatHint,
  MatLabel,
  MatPrefix,
  MatSuffix,
  getMatFormFieldDuplicatedHintError,
  getMatFormFieldMissingControlError,
  getMatFormFieldPlaceholderConflictError
} from "./chunk-E6DMKY4Y.js";
import "./chunk-RFSWWGZ5.js";
import "./chunk-5XYFHA5V.js";
import "./chunk-GEHY2IID.js";
import "./chunk-WMCF36ZG.js";
import "./chunk-OSMU42NZ.js";
import "./chunk-ZODY4YC6.js";
import "./chunk-S5IPEXDS.js";
import "./chunk-4NRDWZRV.js";
import "./chunk-V6HYME63.js";
import "./chunk-L7JRAG6F.js";
import "./chunk-WLPF7S6A.js";
import "./chunk-ZCPTMQPA.js";
import "./chunk-IPQESBWB.js";
import "./chunk-TT3N2SQG.js";
import "./chunk-B4DTGZCK.js";
import "./chunk-IMCI5YW7.js";
import "./chunk-SQGEQWTL.js";
import "./chunk-FNMPRIPY.js";
import {
  require_cjs
} from "./chunk-7SULSMEY.js";
import {
  require_operators
} from "./chunk-JRBTNWFI.js";
import "./chunk-W6MIQTXE.js";
import {
  __toESM
} from "./chunk-YHCV7DAQ.js";

// node_modules/@angular/material/fesm2022/form-field.mjs
var import_rxjs = __toESM(require_cjs(), 1);
var import_operators = __toESM(require_operators(), 1);
var matFormFieldAnimations = {
  // Represents:
  // trigger('transitionMessages', [
  //   // TODO(mmalerba): Use angular animations for label animation as well.
  //   state('enter', style({opacity: 1, transform: 'translateY(0%)'})),
  //   transition('void => enter', [
  //     style({opacity: 0, transform: 'translateY(-5px)'}),
  //     animate('300ms cubic-bezier(0.55, 0, 0.55, 0.2)'),
  //   ]),
  // ])
  /** Animation that transitions the form field's error and hint messages. */
  transitionMessages: {
    type: 7,
    name: "transitionMessages",
    definitions: [
      {
        type: 0,
        name: "enter",
        styles: {
          type: 6,
          styles: { opacity: 1, transform: "translateY(0%)" },
          offset: null
        }
      },
      {
        type: 1,
        expr: "void => enter",
        animation: [
          { type: 6, styles: { opacity: 0, transform: "translateY(-5px)" }, offset: null },
          { type: 4, styles: null, timings: "300ms cubic-bezier(0.55, 0, 0.55, 0.2)" }
        ],
        options: null
      }
    ],
    options: {}
  }
};
export {
  MAT_ERROR,
  MAT_FORM_FIELD,
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MAT_PREFIX,
  MAT_SUFFIX,
  MatError,
  MatFormField,
  MatFormFieldControl,
  MatFormFieldModule,
  MatHint,
  MatLabel,
  MatPrefix,
  MatSuffix,
  getMatFormFieldDuplicatedHintError,
  getMatFormFieldMissingControlError,
  getMatFormFieldPlaceholderConflictError,
  matFormFieldAnimations
};
//# sourceMappingURL=@angular_material_form-field.js.map
